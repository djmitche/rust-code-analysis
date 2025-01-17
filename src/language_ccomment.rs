// Code generated; DO NOT EDIT.

#[derive(Clone, Debug, PartialEq)]
pub enum Ccomment {
    End = 0,
    Nothing = 1,
    PreprocContinuationLine = 2,
    PreprocLine = 3,
    DefineToken1 = 4,
    StringLiteralToken1 = 5,
    CharLiteralToken1 = 6,
    Comment = 7,
    RawStringLiteral = 8,
    TranslationUnit = 9,
    TopLevelItem = 10,
    Define = 11,
    StringLiteral = 12,
    CharLiteral = 13,
    TranslationUnitRepeat1 = 14,
    DefineRepeat1 = 15,
    Error = 16,
}

impl Into<&'static str> for Ccomment {
    fn into(self) -> &'static str {
        match self {
            Ccomment::End => "end",
            Ccomment::Nothing => "nothing",
            Ccomment::PreprocContinuationLine => "preproc_continuation_line",
            Ccomment::PreprocLine => "preproc_line",
            Ccomment::DefineToken1 => "define_token1",
            Ccomment::StringLiteralToken1 => "string_literal_token1",
            Ccomment::CharLiteralToken1 => "char_literal_token1",
            Ccomment::Comment => "comment",
            Ccomment::RawStringLiteral => "raw_string_literal",
            Ccomment::TranslationUnit => "translation_unit",
            Ccomment::TopLevelItem => "_top_level_item",
            Ccomment::Define => "define",
            Ccomment::StringLiteral => "string_literal",
            Ccomment::CharLiteral => "char_literal",
            Ccomment::TranslationUnitRepeat1 => "translation_unit_repeat1",
            Ccomment::DefineRepeat1 => "define_repeat1",
            Ccomment::Error => "ERROR",
        }
    }
}

#[allow(clippy::unreadable_literal)]
static KEYS: phf::Map<&'static str, Ccomment> = ::phf::Map {
    key: 3213172566270843353,
    disps: ::phf::Slice::Static(&[(4, 13), (2, 0), (2, 0), (8, 0)]),
    entries: ::phf::Slice::Static(&[
        ("translation_unit_repeat1", Ccomment::TranslationUnitRepeat1),
        ("preproc_line", Ccomment::PreprocLine),
        ("comment", Ccomment::Comment),
        ("nothing", Ccomment::Nothing),
        ("raw_string_literal", Ccomment::RawStringLiteral),
        ("string_literal", Ccomment::StringLiteral),
        ("define_token1", Ccomment::DefineToken1),
        ("string_literal_token1", Ccomment::StringLiteralToken1),
        ("translation_unit", Ccomment::TranslationUnit),
        ("_top_level_item", Ccomment::TopLevelItem),
        ("end", Ccomment::End),
        ("define_repeat1", Ccomment::DefineRepeat1),
        ("char_literal", Ccomment::CharLiteral),
        ("ERROR", Ccomment::Error),
        ("char_literal_token1", Ccomment::CharLiteralToken1),
        (
            "preproc_continuation_line",
            Ccomment::PreprocContinuationLine,
        ),
        ("define", Ccomment::Define),
    ]),
};

impl From<&str> for Ccomment {
    #[inline(always)]
    fn from(key: &str) -> Self {
        KEYS.get(key).unwrap().clone()
    }
}

impl From<u16> for Ccomment {
    #[inline(always)]
    fn from(x: u16) -> Self {
        unsafe { std::mem::transmute(x as u8) }
    }
}

// Ccomment == u16
impl PartialEq<u16> for Ccomment {
    #[inline(always)]
    fn eq(&self, x: &u16) -> bool {
        *self == Ccomment::from(*x)
    }
}

// u16 == Ccomment
impl PartialEq<Ccomment> for u16 {
    #[inline(always)]
    fn eq(&self, x: &Ccomment) -> bool {
        *x == *self
    }
}
