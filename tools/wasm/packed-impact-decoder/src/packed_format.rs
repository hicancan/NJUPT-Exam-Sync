use wasm_bindgen::prelude::*;

const MAGIC_V1: &[u8] = b"SGIXB001";
const MAGIC_V2: &[u8] = b"SGIXB002";

pub(crate) enum PackedFormat {
    V1,
    V2,
}

pub(crate) struct Cursor<'a> {
    pub(crate) data: &'a [u8],
    pub(crate) offset: usize,
}

impl<'a> Cursor<'a> {
    pub(crate) fn new(data: &'a [u8]) -> Self {
        Self { data, offset: 0 }
    }

    pub(crate) fn read_byte(&mut self) -> Result<u8, JsValue> {
        let byte = self
            .data
            .get(self.offset)
            .copied()
            .ok_or_else(|| JsValue::from_str("truncated byte"))?;
        self.offset += 1;
        Ok(byte)
    }

    pub(crate) fn read_bytes(&mut self, length: usize) -> Result<&'a [u8], JsValue> {
        let end = self
            .offset
            .checked_add(length)
            .ok_or_else(|| JsValue::from_str("length overflow"))?;
        if end > self.data.len() {
            return Err(JsValue::from_str("truncated bytes"));
        }
        let bytes = &self.data[self.offset..end];
        self.offset = end;
        Ok(bytes)
    }

    pub(crate) fn read_u32_le(&mut self) -> Result<u32, JsValue> {
        let b0 = self.read_byte()? as u32;
        let b1 = self.read_byte()? as u32;
        let b2 = self.read_byte()? as u32;
        let b3 = self.read_byte()? as u32;
        Ok(b0 | (b1 << 8) | (b2 << 16) | (b3 << 24))
    }

    pub(crate) fn read_varint(&mut self) -> Result<u64, JsValue> {
        let mut shift = 0_u32;
        let mut value = 0_u64;
        loop {
            let byte = self.read_byte()?;
            value = value
                .checked_add(((byte & 0x7f) as u64) << shift)
                .ok_or_else(|| JsValue::from_str("varint overflow"))?;
            if byte & 0x80 == 0 {
                return Ok(value);
            }
            shift += 7;
            if shift > 63 {
                return Err(JsValue::from_str("varint exceeds u64"));
            }
        }
    }

    pub(crate) fn read_magic(&mut self) -> Result<PackedFormat, JsValue> {
        let magic = self.read_bytes(MAGIC_V1.len())?;
        if magic == MAGIC_V2 {
            Ok(PackedFormat::V2)
        } else if magic == MAGIC_V1 {
            Ok(PackedFormat::V1)
        } else {
            Err(JsValue::from_str("invalid packed impact index header"))
        }
    }

    pub(crate) fn is_done(&self) -> bool {
        self.offset == self.data.len()
    }
}

pub(crate) struct Stats {
    pub(crate) field_count: u64,
    pub(crate) posting_count: u64,
    pub(crate) max_doc_id: u64,
}
