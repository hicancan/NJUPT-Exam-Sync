import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import os
import re
import urllib3

# 禁用 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- 配置区域 ---
LIST_URL = "https://jwc.njupt.edu.cn/1594/list.htm"
SAVE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "data")

# 1. 必须包含的关键词 (且关系)
REQUIRED_KEYWORDS = ["学年", "学期"]
# 2. 必须包含其中之一的关键词 (或关系)
TARGET_KEYWORDS = ["考试安排表", "期末考试", "课程结束考试"]
# 3. 绝对不能包含的关键词 (排除噪音)
EXCLUDE_KEYWORDS = [
    "阶段性", "补考", "清欠", "分级", "补学", "换证", 
    "重修", "选拔", "竞赛", "发车", "监考"
]

# 伪装请求头
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://jwc.njupt.edu.cn/"
}

def is_valid_title(title):
    """
    判断标题是否为正规期末考试安排
    """
    # 1. 检查排除词
    for kw in EXCLUDE_KEYWORDS:
        if kw in title:
            return False
    
    # 2. 检查必须包含的词
    for kw in REQUIRED_KEYWORDS:
        if kw not in title:
            return False
            
    # 3. 检查目标词 (至少命中一个)
    if not any(kw in title for kw in TARGET_KEYWORDS):
        return False
        
    return True

def is_student_file(filename):
    """判断是否为学生用表"""
    return "学生" in filename

def is_teacher_file(filename):
    """判断是否为教师/监考表"""
    keywords = ["监考", "教师", "巡考", "教务员"]
    return any(kw in filename for kw in keywords)

def download_file(url, save_path):
    try:
        print(f"  ⬇️  下载中: {os.path.basename(save_path)} ...", end="", flush=True)
        response = requests.get(url, headers=HEADERS, verify=False, timeout=30)
        response.raise_for_status()
        with open(save_path, 'wb') as f:
            f.write(response.content)
        print(" [完成]")
        return True
    except Exception as e:
        print(f" [失败] {e}")
        return False

def find_latest_schedule_notification():
    """遍历列表页，寻找最新的、符合逻辑的通知"""
    print(f"🔍 访问通知列表: {LIST_URL}")
    try:
        resp = requests.get(LIST_URL, headers=HEADERS, verify=False, timeout=10)
        resp.encoding = 'utf-8'
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        container = soup.select_one('div.col_news_con')
        if not container:
            print("❌ 未找到列表容器，请检查选择器。")
            return None

        news_items = container.select('li.news')
        
        for item in news_items:
            # 提取标题
            title_span = item.select_one('span.news_title')
            a_tag = title_span.find('a') if title_span else item.find('a')
            
            if not a_tag: continue
            
            title = a_tag.get('title') or a_tag.get_text(strip=True)
            link = urljoin(LIST_URL, a_tag.get('href'))
            
            # 使用增强的逻辑判断标题
            if is_valid_title(title):
                print(f"✅ 命中目标: [{title}]")
                print(f"🔗 链接地址: {link}")
                return link, title
            else:
                # 开启此行可查看被过滤掉的标题（调试用）
                # print(f"   跳过: {title}")
                pass
        
        print("⚠️ 未在首页找到符合条件的期末考试通知。")
        return None
        
    except Exception as e:
        print(f"❌ 列表获取失败: {e}")
        return None

def process_detail_page(url, title):
    """解析详情页并智能下载附件"""
    print(f"🔍 解析详情页附件...")
    try:
        resp = requests.get(url, headers=HEADERS, verify=False, timeout=10)
        resp.encoding = 'utf-8'
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        all_links = soup.find_all('a')
        
        # 1. 收集所有 Excel 候选链接
        candidates = []
        for a in all_links:
            href = a.get('href')
            if not href: continue
            
            if href.lower().endswith(('.xls', '.xlsx')):
                full_url = urljoin(url, href)
                name = a.get_text(strip=True)
                if not name.lower().endswith(('.xls', '.xlsx')):
                    name = os.path.basename(href)
                # 清理文件名
                name = re.sub(r'[\\/*?:"<>|]', "", name)
                candidates.append({'name': name, 'url': full_url})

        if not candidates:
            print("⚠️ 未发现 Excel 附件。")
            return

        # 2. 智能筛选附件
        # 策略: 如果有含 "学生" 的文件，只下载这些。否则下载所有非 "监考" 的文件。
        student_files = [f for f in candidates if is_student_file(f['name'])]
        
        final_targets = []
        if student_files:
            print(f"🎯 检测到 {len(student_files)} 个学生专用文件，仅下载这些。")
            final_targets = student_files
        else:
            print("ℹ️ 未检测到明确的'学生版'文件，将下载所有非监考文件。")
            final_targets = [f for f in candidates if not is_teacher_file(f['name'])]

        # 3. 执行下载
        if not os.path.exists(SAVE_DIR):
            os.makedirs(SAVE_DIR)
        else:
            # [Added] Clean up old Excel files to prevent duplicates
            print("🧹 清理旧数据文件...")
            for f in os.listdir(SAVE_DIR):
                if f.endswith('.xlsx') or f.endswith('.xls'):
                    try:
                        os.remove(os.path.join(SAVE_DIR, f))
                        print(f"   - 删除: {f}")
                    except Exception as e:
                        print(f"   ❌ 删除失败 {f}: {e}")
            
        count = 0
        downloaded_files = []
        for file_info in final_targets:
            save_path = os.path.join(SAVE_DIR, file_info['name'])
            if download_file(file_info['url'], save_path):
                count += 1
                downloaded_files.append(file_info['name'])
        
        if count > 0:
            import json
            from datetime import datetime, timezone, timedelta
            
            # Beijing Time Helper
            beijing_tz = timezone(timedelta(hours=8))
            now_beijing = datetime.now(timezone.utc).astimezone(beijing_tz)

            metadata = {
                "source_url": url,
                "source_title": title,
                "downloaded_files": downloaded_files,
                "updated_at": now_beijing.isoformat()
            }
            meta_path = os.path.join(SAVE_DIR, "source_metadata.json")
            with open(meta_path, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
            print(f"💾 元数据已保存: {meta_path}")

        print(f"\n🎉 处理完毕！成功下载 {count} 个文件。")
            
    except Exception as e:
        print(f"❌ 详情页解析失败: {e}")

if __name__ == "__main__":
    print("=== NJUPT 考试安排自动同步工具 ===")
    result = find_latest_schedule_notification()
    if result:
        url, title = result
        process_detail_page(url, title)
    else:
        print("未进行任何更新。")