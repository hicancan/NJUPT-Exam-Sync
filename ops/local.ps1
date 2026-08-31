[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$StaticSiteGraphPath,

    [Parameter(Mandatory = $true)]
    [string]$NjuptSiteGraphPath,

    [Parameter(Mandatory = $true)]
    [string]$NjuptSearchPath,

    [ValidateSet('quick', 'full', 'crawl')]
    [string]$Mode = 'quick',

    [string]$SiteId,

    [Parameter(Mandatory = $true)]
    [string]$SitePackagesPath,

    [string]$CorpusPath,

    [string]$BundlePath,

    [string]$BaselineBundlePath,
    [string]$ExamSourcePath,
    [string]$ExamMaterializedPath,
    [string]$ExamCachePath,
    [string]$ExamSnapshotPath,
    [string]$ExamHistoryPath,
    [string]$RoomOccupancyPath,
    [string]$TeachingSourcePath,
    [string]$TeachingSchedulePath,
    [string]$TeachingRoomOccupancyPath,
    [string]$RoomCatalogPath,
    [string]$WebStagePath,
    [string]$WebDistPath,

    [switch]$StartWeb
)

$ErrorActionPreference = 'Stop'
$staticRepository = (Resolve-Path -LiteralPath $StaticSiteGraphPath).Path
$siteRepository = (Resolve-Path -LiteralPath $NjuptSiteGraphPath).Path
$searchRepository = (Resolve-Path -LiteralPath $NjuptSearchPath).Path
$sitePackages = [System.IO.Path]::GetFullPath($SitePackagesPath)

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,

        [Parameter(Mandatory = $true)]
        [string]$Executable,

        [Parameter(Mandatory = $true)]
        [string[]]$CommandArguments
    )

    Push-Location $WorkingDirectory
    try {
        & $Executable @CommandArguments
        if ($LASTEXITCODE -ne 0) {
            throw "$Executable failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

Invoke-Checked $staticRepository 'uv' @('run', 'pytest', '-q')
Invoke-Checked $siteRepository 'uv' @('run', 'pytest', '-q')
Invoke-Checked $siteRepository 'uv' @(
    'run', 'python', 'ops/njupt.py', 'validate-configs'
)
Invoke-Checked $siteRepository 'uv' @(
    'run', 'python', 'ops/njupt.py', 'dry-run',
    '--packages-root', $sitePackages
)
if ($Mode -eq 'quick') {
    & (Join-Path $searchRepository 'ops/test.ps1') -Mode quick
}

if ($Mode -in @('full', 'crawl')) {
    if (-not $CorpusPath -or -not $BundlePath) {
        throw '-CorpusPath and -BundlePath are required for full and crawl modes'
    }
    $corpus = [System.IO.Path]::GetFullPath($CorpusPath)
    $bundle = [System.IO.Path]::GetFullPath($BundlePath)

    if ($Mode -eq 'crawl') {
        $crawlArguments = @(
            'run', 'python', 'ops/njupt.py', 'crawl',
            '--packages-root', $sitePackages
        )
        if ($SiteId) {
            $crawlArguments += @('--include', $SiteId)
        }
        Invoke-Checked $siteRepository 'uv' $crawlArguments
    }

    Invoke-Checked $siteRepository 'uv' @(
        'run', 'python', 'ops/njupt.py', 'validate-packages',
        '--packages-root', $sitePackages
    )
    Invoke-Checked $siteRepository 'uv' @(
        'run', 'python', 'ops/njupt.py', 'export-corpus',
        '--packages-root', $sitePackages,
        '--out', $corpus
    )
    & (Join-Path $searchRepository 'ops/test.ps1') `
        -Mode full `
        -CorpusPath $corpus `
        -BundlePath $bundle `
        -BaselineBundlePath $BaselineBundlePath `
        -ExamSourcePath $ExamSourcePath `
        -ExamMaterializedPath $ExamMaterializedPath `
        -ExamCachePath $ExamCachePath `
        -ExamSnapshotPath $ExamSnapshotPath `
        -ExamHistoryPath $ExamHistoryPath `
        -RoomOccupancyPath $RoomOccupancyPath `
        -TeachingSourcePath $TeachingSourcePath `
        -TeachingSchedulePath $TeachingSchedulePath `
        -TeachingRoomOccupancyPath $TeachingRoomOccupancyPath `
        -RoomCatalogPath $RoomCatalogPath `
        -WebStagePath $WebStagePath `
        -WebDistPath $WebDistPath
}

if ($StartWeb) {
    if (-not $WebStagePath) {
        throw '-WebStagePath is required with -StartWeb'
    }
    $public = Join-Path ([System.IO.Path]::GetFullPath($WebStagePath)) 'public'
    if (-not (Test-Path -LiteralPath $public -PathType Container)) {
        throw "Assembled Web public directory is missing: $public"
    }
    $previousPublic = $env:NJUPT_SEARCH_WEB_PUBLIC_DIR
    $previousSearchUrl = $env:VITE_NJUPT_SEARCH_ARTIFACT_URL
    $previousExamUrl = $env:VITE_NJUPT_EXAM_ARTIFACT_URL
    $previousRoomUrl = $env:VITE_NJUPT_ROOM_ARTIFACT_URL
    $previousTimetableUrl = $env:VITE_NJUPT_TIMETABLE_ARTIFACT_URL
    $previousClassroomsUrl = $env:VITE_NJUPT_CLASSROOMS_ARTIFACT_URL
    try {
        $env:NJUPT_SEARCH_WEB_PUBLIC_DIR = $public
        $env:VITE_NJUPT_SEARCH_ARTIFACT_URL = '/generated/search'
        $env:VITE_NJUPT_EXAM_ARTIFACT_URL = '/generated/exam'
        $env:VITE_NJUPT_ROOM_ARTIFACT_URL = '/generated/rooms'
        $env:VITE_NJUPT_TIMETABLE_ARTIFACT_URL = '/generated/timetable'
        $env:VITE_NJUPT_CLASSROOMS_ARTIFACT_URL = '/generated/classrooms'
        Invoke-Checked $searchRepository 'npm' @(
            'run', 'dev', '--', '--host', '127.0.0.1'
        )
    }
    finally {
        $env:NJUPT_SEARCH_WEB_PUBLIC_DIR = $previousPublic
        $env:VITE_NJUPT_SEARCH_ARTIFACT_URL = $previousSearchUrl
        $env:VITE_NJUPT_EXAM_ARTIFACT_URL = $previousExamUrl
        $env:VITE_NJUPT_ROOM_ARTIFACT_URL = $previousRoomUrl
        $env:VITE_NJUPT_TIMETABLE_ARTIFACT_URL = $previousTimetableUrl
        $env:VITE_NJUPT_CLASSROOMS_ARTIFACT_URL = $previousClassroomsUrl
    }
}
