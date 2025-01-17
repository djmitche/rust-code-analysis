const PREC = {
  PAREN_DECLARATOR: -10,
  ASSIGNMENT: -1,
  CONDITIONAL: -2,
  DEFAULT: 0,
  LOGICAL_OR: 1,
  LOGICAL_AND: 2,
  INCLUSIVE_OR: 3,
  EXCLUSIVE_OR: 4,
  BITWISE_AND: 5,
  EQUAL: 6,
  RELATIONAL: 7,
  SIZEOF: 8,
  SHIFT: 9,
  ADD: 10,
  MULTIPLY: 11,
  CAST: 12,
  UNARY: 13,
  CALL: 14,
  FIELD: 15,
  SUBSCRIPT: 16
};

module.exports = grammar({
  name: 'c',

  /* issues:
     void $$$() { ... } => we've a fn def/decl but the id is a macro id.
   */

  /* TODO:
     __try, __except (Microsoft C)
     inlined assembly
     namespace A = B;
     int64_t(...)
   */

  extras: $ => [
    /\s/,
    $.comment,
    $.macro,
  ],

  inline: $ => [
    $._statement,
    $._top_level_item,
    $._type_identifier,
    $._field_identifier,
    $._statement_identifier,
  ],

  conflicts: $ => [
    [$._type_specifier, $._declarator],
    [$._type_specifier, $._expression],
    [$.sized_type_specifier],
    [$.preproc_expression],
    [$._declaration_specifiers],
    [$._declaration_specifiers_no_type],
    [$._declaration_specifiers_no_type, $._expression],
    [$._declaration_specifiers, $._declaration_specifiers_no_type],
    [$._declaration_specifiers, $._declaration_specifiers_no_type, $._expression],
    [$._declarator, $.pointer_declarator, $.abstract_pointer_declarator],
  ],

  word: $ => $.identifier,

  rules: {
    translation_unit: $ => repeat($._top_level_item),

    _top_level_item: $ => choice(
      $.function_definition,
      $.linkage_specification,
      $.declaration,
      $._statement,
      $.type_definition,
      $._empty_declaration,
    ),

    macro: $ => prec(-1, token(
      /\$+/
    )),

    only_macro: $ => seq(
      $.macro,
      '\n',
    ),

    macro_call: $ => prec(PREC.CALL, seq(
      seq($.macro, $.argument_list),
    )),

    only_macro_call: $ => seq(
      $.macro_call,
      '\n',
    ),

    // Preprocesser
    preproc_include: $ => seq(
      preprocessor('include'),
      field('path', choice($.string_literal, $.system_lib_string))
    ),

    preproc_def: $ => seq(
      preprocessor('define'),
      field('name', choice($.macro, $.identifier)),
      field('value', optional($.preproc_arg)),
      '\n'
    ),

    preproc_function_def: $ => seq(
      preprocessor('define'),
      field('name', choice($.macro, $.identifier)),
      field('parameters', $.preproc_params),
      field('value', optional($.preproc_arg)),
      '\n'
    ),

    preproc_params: $ => seq(
      token.immediate('('), commaSep(choice(seq(optional(/\\\r?\n/), $.identifier, optional(/\\\r?\n/)), '...')), ')'
    ),

    preproc_call: $ => seq(
      field('directive', $.preproc_directive),
      field('argument', optional($.preproc_arg)),
      '\n'
    ),

    ...preprocIf('', $ => $._top_level_item),
    ...preprocIf('_in_field_declaration_list', $ => $._field_declaration_list_item),

    preproc_directive: $ => /#[ \t]*[a-zA-Z]\w*/,
    preproc_arg: $ => token(prec(-1, repeat1(/.|\\\r?\n/))),

    line_continuation: $ => token(
      /\\\r?\n/
    ),

    preproc_condition: $ => seq(
      $.preproc_expression,
      '\n',
    ),

    preproc_expression: $ => seq(
      optional($.line_continuation),
      choice(
        $.macro,
        $.identifier,
        prec(PREC.CALL, seq(choice($.macro, $.identifier), '(', commaSep($.preproc_expression), ')')),
        $.number_literal,
        $.char_literal,
        $.preproc_unary_expression,
        $.preproc_binary_expression,
        $.preproc_defined,
        $.preproc_parenthesized_expression,
      ),
      optional($.line_continuation),
    ),

    preproc_parenthesized_expression: $ => seq(
      '(',
      $.preproc_expression,
      ')'
    ),

    preproc_defined: $ => choice(
      prec(PREC.CALL, seq('defined', '(', choice($.identifier, $.macro), ')')),
      seq('defined', choice($.identifier, $.macro)),
    ),

    preproc_unary_expression: $ => prec.left(PREC.UNARY, seq(
      field('operator', choice('!', '~', '-', '+')),
      field('argument', $.preproc_expression)
    )),

    preproc_binary_expression: $ => {
      const table = [
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULTIPLY],
        ['/', PREC.MULTIPLY],
        ['%', PREC.MULTIPLY],
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['|', PREC.INCLUSIVE_OR],
        ['^', PREC.EXCLUSIVE_OR],
        ['&', PREC.BITWISE_AND],
        ['==', PREC.EQUAL],
        ['!=', PREC.EQUAL],
        ['>', PREC.RELATIONAL],
        ['>=', PREC.RELATIONAL],
        ['<=', PREC.RELATIONAL],
        ['<', PREC.RELATIONAL],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', $.preproc_expression),
          field('operator', operator),
          field('right', $.preproc_expression)
        ))
      }));
    },

    // Main Grammar

    call_convention: $ => choice(
      '__cdecl',
      '__clrcall',
      '__stdcall',
      '__fastcall',
      '__thiscall',
      '__vectorcall',
      'WINAPI',
      'CALLBACK',
    ),

    function_definition: $ => seq(
      choice($._declaration_specifiers, $._declaration_specifiers_no_type),
      optional($.call_convention),
      field('declarator', $._declarator),
      field('body', $.compound_statement)
    ),

    declaration: $ => seq(
      choice($._declaration_specifiers, $._declaration_specifiers_no_type),
      optional($.call_convention),
      commaSep1(field('declarator', choice(
        $._declarator,
        $.init_declarator
      ))),
      ';'
    ),

    type_definition: $ => seq(
      'typedef',
      repeat($.type_qualifier),
      field('type', $._type_specifier),
      commaSep1(field('declarator', $._type_declarator)),
      ';'
    ),

    _declaration_specifiers: $ => prec.dynamic(0, seq(
      repeat(choice(
        $.macro,
        $.macro_call,
        $.storage_class_specifier,
        $.type_qualifier,
        $.attribute_specifier,
      )),
      field('type', $._type_specifier),
      repeat(choice(
        $.storage_class_specifier,
        $.type_qualifier,
        $.attribute_specifier,
        $.macro_call,
        $.macro,
      ))
    )),

    _declaration_specifiers_no_type: $ => prec.dynamic(0, seq(
      repeat1(choice(
        $.macro,
        $.macro_call,
        $.storage_class_specifier,
        $.type_qualifier,
        $.attribute_specifier,
      )),
    )),

    linkage_specification: $ => seq(
      'extern',
      field('value', $.string_literal),
      field('body', choice(
        $.function_definition,
        $.declaration,
        $.declaration_list
      ))
    ),

    attribute_specifier: $ => seq(
      '__attribute__',
      '(',
      $.argument_list,
      ')'
    ),

    declaration_list: $ => seq(
      '{',
      repeat($._top_level_item),
      '}'
    ),

    _declarator: $ => choice(
      $.pointer_declarator,
      $.function_declarator,
      $.array_declarator,
      $.parenthesized_declarator,
      $.identifier,
      $.macro,
    ),

    _field_declarator: $ => choice(
      alias($.pointer_field_declarator, $.pointer_declarator),
      alias($.function_field_declarator, $.function_declarator),
      alias($.array_field_declarator, $.array_declarator),
      alias($.parenthesized_field_declarator, $.parenthesized_declarator),
      $._field_identifier
    ),

    _type_declarator: $ => choice(
      alias($.pointer_type_declarator, $.pointer_declarator),
      alias($.function_type_declarator, $.function_declarator),
      alias($.array_type_declarator, $.array_declarator),
      alias($.parenthesized_type_declarator, $.parenthesized_declarator),
      $._type_identifier
    ),

    _abstract_declarator: $ => choice(
      $.abstract_pointer_declarator,
      $.abstract_function_declarator,
      $.abstract_array_declarator,
      $.abstract_parenthesized_declarator,
    ),

    parenthesized_declarator: $ => prec.dynamic(PREC.PAREN_DECLARATOR, seq(
      '(',
      $._declarator,
      ')'
    )),
    parenthesized_field_declarator: $ => prec.dynamic(PREC.PAREN_DECLARATOR, seq(
      '(',
      $._field_declarator,
      ')'
    )),
    parenthesized_type_declarator: $ => prec.dynamic(PREC.PAREN_DECLARATOR, seq(
      '(',
      $._type_declarator,
      ')'
    )),
    abstract_parenthesized_declarator: $ => prec(1, seq(
      '(',
      $._abstract_declarator,
      ')'
    )),

    pointer_declarator: $ => prec.dynamic(1, prec.right(seq(
      '*',
      repeat(choice($.macro, $.macro_call, $.type_qualifier)),
      field('declarator', $._declarator)
    ))),
    pointer_field_declarator: $ => prec.dynamic(1, prec.right(seq(
      '*',
      repeat(choice($.macro, $.macro_call, $.type_qualifier)),
      field('declarator', $._field_declarator)
    ))),
    pointer_type_declarator: $ => prec.dynamic(1, prec.right(seq(
      '*',
      repeat(choice($.macro, $.macro_call, $.type_qualifier)),
      field('declarator', $._type_declarator)
    ))),
    abstract_pointer_declarator: $ => prec.dynamic(1, prec.right(seq('*',
                                                                     repeat(choice($.macro, $.macro_call, $.type_qualifier)),
                                                                     field('declarator', optional($._abstract_declarator))
    ))),

    function_declarator: $ => prec(1, seq(
      field('declarator', $._declarator),
      field('parameters', $.parameter_list),
      repeat(choice($.macro, $.macro_call, $.attribute_specifier))
    )),
    function_field_declarator: $ => prec(1, seq(
      field('declarator', $._field_declarator),
      field('parameters', $.parameter_list)
    )),
    function_type_declarator: $ => prec(1, seq(
      field('declarator', $._type_declarator),
      field('parameters', $.parameter_list)
    )),
    abstract_function_declarator: $ => prec(1, seq(
      field('declarator', optional($._abstract_declarator)),
      field('parameters', $.parameter_list)
    )),

    array_declarator: $ => prec(1, seq(
      field('declarator', $._declarator),
      '[',
      repeat($.type_qualifier),
      field('size', optional(choice($._expression, '*'))),
      ']'
    )),
    array_field_declarator: $ => prec(1, seq(
      field('declarator', $._field_declarator),
      '[',
      repeat($.type_qualifier),
      field('size', optional(choice($._expression, '*'))),
      ']'
    )),
    array_type_declarator: $ => prec(1, seq(
      field('declarator', $._type_declarator),
      '[',
      repeat($.type_qualifier),
      field('size', optional(choice($._expression, '*'))),
      ']'
    )),
    abstract_array_declarator: $ => prec(1, seq(
      field('declarator', optional($._abstract_declarator)),
      '[',
      repeat($.type_qualifier),
      field('size', optional(choice($._expression, '*'))),
      ']'
    )),

    init_declarator: $ => seq(
      field('declarator', $._declarator),
      '=',
      field('value', choice($.initializer_list, $._expression))
    ),

    compound_statement: $ => seq(
      '{',
      repeat($._top_level_item),
      '}'
    ),

    storage_class_specifier: $ => choice(
      'extern',
      'static' ,
      'auto',
      'register',
      'inline'
    ),

    type_qualifier: $ => choice(
      'const',
      'CONST',
      'volatile',
      'restrict',
      'vector',
      '_Atomic'
    ),

    _type_specifier: $ => choice(
      $.struct_specifier,
      $.union_specifier,
      $.enum_specifier,
      $.sized_type_specifier,
      $.primitive_type,
      $._type_identifier
    ),

    sized_type_specifier: $ => seq(
      repeat1(choice(
        'signed',
        'unsigned',
        'long',
        'short'
      )),
      field('type', optional(choice(
        prec.dynamic(-1, $._type_identifier),
        $.primitive_type
      )))
    ),

    primitive_type: $ => token(choice(
      'APIENTRY',
      'ATOM',
      'BOOL',
      'BOOLEAN',
      'BYTE',
      'CCHAR',
      'CHAR',
      'COLORREF',
      'DWORD',
      'DWORDLONG',
      'DWORD_PTR',
      'DWORD32',
      'DWORD64',
      'FLOAT',
      'HACCEL',
      'HALF_PTR',
      'HANDLE',
      'HBITMAP',
      'HBRUSH',
      'HCOLORSPACE',
      'HCONV',
      'HCONVLIST',
      'HCURSOR',
      'HDC',
      'HDDEDATA',
      'HDESK',
      'HDROP',
      'HDWP',
      'HENHMETAFILE',
      'HFILE',
      'HFONT',
      'HGDIOBJ',
      'HGLOBAL',
      'HHOOK',
      'HICON',
      'HINSTANCE',
      'HKEY',
      'HKL',
      'HLOCAL',
      'HMENU',
      'HMETAFILE',
      'HMODULE',
      'HMONITOR',
      'HPALETTE',
      'HPEN',
      'HRESULT',
      'HRGN',
      'HRSRC',
      'HSZ',
      'HWINSTA',
      'HWND',
      'INT',
      'INT_PTR',
      'INT8',
      'INT16',
      'INT32',
      'INT64',
      'LANGID',
      'LCID',
      'LCTYPE',
      'LGRPID',
      'LONG',
      'LONGLONG',
      'LONG_PTR',
      'LONG32',
      'LONG64',
      'LPARAM',
      'LPBOOL',
      'LPBYTE',
      'LPCOLORREF',
      'LPCSTR',
      'LPCVOID',
      'LPCWSTR',
      'LPDWORD',
      'LPHANDLE',
      'LPINT',
      'LPLONG',
      'LPSTR',
      'LPTSTR',
      'LPWOID',
      'LPWORD',
      'LPWSTR',
      'LRESULT',
      'PBOOL',
      'PBOOLEAN',
      'PBYTE',
      'PCHAR',
      'PCSTR',
      'PCTSTR',
      'PCWSTR',
      'PDWORD',
      'PDWORDLONG',
      'PDWORD_PTR',
      'PDWORD32',
      'PDWORD64',
      'PFLOAT',
      'PHALF_PTR',
      'PHANDLE',
      'PHKEY',
      'PINT',
      'PINT_PTR',
      'PINT8',
      'PINT16',
      'PINT32',
      'PINT64',
      'PLCID',
      'PLONG',
      'PLONGLONG',
      'PLONG32',
      'PLONG64',
      'POINTER_32',
      'POINTER_64',
      'POINTER_SIGNED',
      'POINTER_UNSIGNED',
      'PSHORT',
      'PSIZE_T',
      'PSSIZE_T',
      'PSTR',
      'PTBYTE',
      'PTCHAR',
      'PTSTR',
      'PUCHAR',
      'PUHALF_PTR',
      'PUINT',
      'PUINT_PTR',
      'PUINT8',
      'PUINT16',
      'PUINT32',
      'PUINT64',
      'PULONG',
      'PULONGLONG',
      'PULONG32',
      'PULONG64',
      'PUSHORT',
      'PVOID',
      'PWCHAR',
      'PWORD',
      'PWSTR',
      'QWORD',
      'SC_HANDLE',
      'SC_LOCK',
      'SERVICE_STATUS_HANDLE',
      'SHORT',
      'SIZE_T',
      'SSIZE_T',
      'TBYTE',
      'TCHAR',
      'UCHAR',
      'UHALF_PTR',
      'UINT',
      'UINT_PTR',
      'UINT8',
      'UINT16',
      'UINT32',
      'UINT64',
      'ULONG',
      'ULONGLONG',
      'ULONG_PTR',
      'ULONG32',
      'ULONG64',
      'UNICODE_STRING',
      'USHORT',
      'USN',
      'VOID',
      'WCHAR',
      'WORD',
      'WPARAM',
      'bool',
      'char',
      'int',
      'float',
      'double',
      'void',
      'size_t',
      'ssize_t',
      'intptr_t',
      'uintptr_t',
      'charptr_t',
      'intmax_t',
      'intptr_t',
      'uintmax_t',
      'uintptr_t',
      'ptrdiff_t',
      'max_align_t',
      'wchar_t',
      'sig_atomic_t',
      ...[8, 16, 32, 64].map(n => `int${n}_t`),
      ...[8, 16, 32, 64].map(n => `uint${n}_t`),
      ...[8, 16, 32, 64].map(n => `char${n}_t`),
      ...[8, 16, 32, 64].map(n => `int_fast${n}_t`),
      ...[8, 16, 32, 64].map(n => `int_least${n}_t`),
      ...[8, 16, 32, 64].map(n => `uint_fast${n}_t`),
      ...[8, 16, 32, 64].map(n => `uint_least${n}_t`),
    )),

    enum_specifier: $ => seq(
      'enum',
      choice(
        seq(
          field('name', $._type_identifier),
          field('body', optional($.enumerator_list))
        ),
        field('body', $.enumerator_list)
      )
    ),

    enumerator_list: $ => seq(
      '{',
      commaSep($.enumerator),
      optional(','),
      '}'
    ),

    struct_specifier: $ => seq(
      'struct',
      choice(
        seq(
          field('name', $._type_identifier),
          field('body', optional($.field_declaration_list))
        ),
        field('body', $.field_declaration_list)
      )
    ),

    union_specifier: $ => seq(
      'union',
      choice(
        seq(
          field('name', $._type_identifier),
          field('body', optional($.field_declaration_list))
        ),
        field('body', $.field_declaration_list)
      )
    ),

    field_declaration_list: $ => seq(
      '{',
      repeat($._field_declaration_list_item),
      '}'
    ),

    _field_declaration_list_item: $ => choice(
      $.field_declaration,
      $.preproc_def,
      $.preproc_function_def,
      $.preproc_call,
      alias($.preproc_if_in_field_declaration_list, $.preproc_if),
      alias($.preproc_ifdef_in_field_declaration_list, $.preproc_ifdef),
    ),

    field_declaration: $ => seq(
      $._declaration_specifiers,
      optional($.call_convention),
      commaSep(field('declarator', $._field_declarator)),
      optional($.bitfield_clause),
      ';'
    ),

    bitfield_clause: $ => seq(':', $._expression),

    enumerator: $ => seq(
      field('name', $.identifier),
      optional(seq('=', field('value', $._expression)))
    ),

    parameter_list: $ => seq(
      '(',
      commaSep(choice($.parameter_declaration, '...')),
      ')'
    ),

    parameter_declaration: $ => seq(
      $._declaration_specifiers,
      optional(field('declarator', choice(
        $._declarator,
        $._abstract_declarator
      )))
    ),

    // Statements

    _statement: $ => choice(
      $.labeled_statement,
      $.compound_statement,
      $.expression_statement,
      $.if_statement,
      $.switch_statement,
      $.do_statement,
      $.while_statement,
      $.for_statement,
      $.return_statement,
      $.break_statement,
      $.continue_statement,
      $.goto_statement,
      $.only_macro,
      $.only_macro_call,
      $.preproc_if,
      $.preproc_ifdef,
      $.preproc_include,
      $.preproc_def,
      $.preproc_function_def,
      $.preproc_call,
    ),

    labeled_statement: $ => seq(
      field('label', $._statement_identifier),
      ':',
      $._statement
    ),

    expression_statement: $ => seq(
      optional(choice(
        $._expression,
        $.comma_expression
      )),
      ';'
    ),

    if_statement: $ => prec.right(seq(
      'if',
      field('condition', $.parenthesized_expression),
      field('consequence', $._statement),
      optional(seq(
        'else',
        field('alternative', $._statement)
      ))
    )),

    switch_statement: $ => seq(
      'switch',
      field('condition', $.parenthesized_expression),
      field('body', alias($.switch_body, $.compound_statement))
    ),

    switch_body: $ => seq(
      '{',
      repeat(choice($.case_statement, $._statement)),
      '}'
    ),

    case_statement: $ => prec.right(seq(
      choice(
        seq('case', field('value', $._expression)),
        'default'
      ),
      ':',
      repeat(choice(
        $._statement,
        $.declaration,
        $.type_definition
      ))
    )),

    while_statement: $ => seq(
      'while',
      field('condition', $.parenthesized_expression),
      field('body', $._statement)
    ),

    do_statement: $ => seq(
      'do',
      field('body', $._statement),
      'while',
      field('condition', $.parenthesized_expression)
    ),

    for_statement: $ => seq(
      'for',
      '(',
      choice(
        field('initializer', $.declaration),
        seq(field('initializer', optional(choice($._expression, $.comma_expression))), ';')
      ),
      field('condition', optional($._expression)), ';',
      field('update', optional(choice($._expression, $.comma_expression))),
      ')',
      $._statement
    ),

    return_statement: $ => seq(
      'return',
      optional($._expression),
      ';'
    ),

    break_statement: $ => seq(
      'break', ';'
    ),

    continue_statement: $ => seq(
      'continue', ';'
    ),

    goto_statement: $ => seq(
      'goto',
      field('label', $._statement_identifier),
      ';'
    ),

    // Expressions

    _expression: $ => choice(
      $.conditional_expression,
      $.assignment_expression,
      $.binary_expression,
      $.unary_expression,
      $.update_expression,
      $.cast_expression,
      $.pointer_expression,
      $.sizeof_expression,
      $.subscript_expression,
      $.call_expression,
      $.field_expression,
      $.compound_literal_expression,
      $.identifier,
      $.number_literal,
      $.string_literal,
      $.concatenated_string,
      $.true,
      $.false,
      $.null,
      $.char_literal,
      $.parenthesized_expression,
      $.macro,
      $.macro_call,
    ),

    comma_expression: $ => seq(
      field('left', $._expression),
      ',',
      field('right', choice($._expression, $.comma_expression))
    ),

    conditional_expression: $ => prec.right(PREC.CONDITIONAL, seq(
      field('condition', $._expression),
      '?',
      field('consequence', $._expression),
      ':',
      field('alternative', $._expression)
    )),

    assignment_expression: $ => prec.right(PREC.ASSIGNMENT, seq(
      field('left', choice(
        $.identifier,
        $.macro,
        $.macro_call,
        $.call_expression,
        $.field_expression,
        $.pointer_expression,
        $.subscript_expression,
        $.parenthesized_expression
      )),
      choice(
        '=',
        '*=',
        '/=',
        '%=',
        '+=',
        '-=',
        '<<=',
        '>>=',
        '&=',
        '^=',
        '|='
      ),
      field('right', choice($._expression, $.initializer_list))
    )),

    pointer_expression: $ => prec.left(PREC.CAST, seq(
      field('operator', choice('*', '&')),
      field('argument', $._expression)
    )),

    unary_expression: $ => prec.left(PREC.UNARY, seq(
      field('operator', choice('!', '~', '-', '+')),
      field('argument', $._expression)
    )),

    binary_expression: $ => {
      const table = [
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULTIPLY],
        ['/', PREC.MULTIPLY],
        ['%', PREC.MULTIPLY],
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['|', PREC.INCLUSIVE_OR],
        ['^', PREC.EXCLUSIVE_OR],
        ['&', PREC.BITWISE_AND],
        ['==', PREC.EQUAL],
        ['!=', PREC.EQUAL],
        ['>', PREC.RELATIONAL],
        ['>=', PREC.RELATIONAL],
        ['<=', PREC.RELATIONAL],
        ['<', PREC.RELATIONAL],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', choice($.only_macro, $.only_macro_call, $._expression)),
          field('operator', operator),
          field('right', $._expression)
        ))
      }));
    },

    update_expression: $ => {
      const argument = field('argument', $._expression);
      const operator = field('operator', choice('--', '++'));
      return prec.right(PREC.UNARY, choice(
        seq(operator, argument),
        seq(argument, operator),
      ));
    },

    cast_expression: $ => prec(PREC.CAST, seq(
      '(',
      field('type', choice($.macro, $.macro_call, $.type_descriptor)),
      ')',
      field('value', $._expression)
    )),

    type_descriptor: $ => seq(
      repeat($.type_qualifier),
      field('type', $._type_specifier),
      repeat($.type_qualifier),
      field('declarator', optional($._abstract_declarator))
    ),

    sizeof_expression: $ => prec(PREC.SIZEOF, seq(
      'sizeof',
      choice(
        field('value', $._expression),
        seq('(', field('type', $.type_descriptor), ')')
      )
    )),

    subscript_expression: $ => prec(PREC.SUBSCRIPT, seq(
      field('argument', $._expression),
      '[',
      field('index', $._expression),
      ']'
    )),

    call_expression: $ => prec(PREC.CALL, seq(
      field('function', $._expression),
      field('arguments', $.argument_list)
    )),

    argument_list: $ => seq('(', commaSep($._expression), ')'),

    field_expression: $ => seq(
      prec(PREC.FIELD, seq(
        field('argument', $._expression),
        choice('.', '->')
      )),
      field('field', $._field_identifier)
    ),

    compound_literal_expression: $ => seq(
      '(',
      field('type', $.type_descriptor),
      ')',
      field('value', $.initializer_list)
    ),

    parenthesized_expression: $ => seq(
      '(',
      choice($._expression, $.comma_expression),
      ')'
    ),

    initializer_list: $ => seq(
      '{',
      commaSep(choice(
        $.initializer_pair,
        $._expression,
        $.initializer_list
      )),
      optional(','),
      '}'
    ),

    initializer_pair: $ => seq(
      field('designator', repeat1(choice($.subscript_designator, $.field_designator))),
      '=',
      field('value', choice($._expression, $.initializer_list))
    ),

    subscript_designator: $ => seq('[', $._expression, ']'),

    field_designator: $ => seq('.', $._field_identifier),

    number_literal: $ => {
      const separator = "'";
      const hex = /[0-9a-fA-F]/;
      const decimal = /[0-9]/;
      const hexDigits = seq(repeat1(hex), repeat(seq(separator, repeat1(hex))));
      const decimalDigits = seq(repeat1(decimal), repeat(seq(separator, repeat1(decimal))));
      return token(seq(
        optional(/[-\+]/),
        optional(choice('0x', '0b')),
        choice(
          seq(
            choice(
              decimalDigits,
              seq('0b', decimalDigits),
              seq('0x', hexDigits)
            ),
            optional(seq('.', optional(hexDigits)))
          ),
          seq('.', decimalDigits)
        ),
        optional(seq(
          /[eEpP]/,
          optional(seq(
            optional(/[-\+]/),
            hexDigits
          ))
        )),
        repeat(choice('u', 'l', 'U', 'L', 'f', 'F'))
      ))
    },

    char_literal: $ => seq(
      choice('L\'', '\''),
      choice(
        $.escape_sequence,
        token.immediate(/[^\n']/)
      ),
      '\''
    ),

    concatenated_string: $ => choice(
      seq(choice($.macro, $.macro_call), $.string_literal),
      seq(optional(choice($.macro, $.macro_call)),
          $.string_literal,
          repeat1(choice($.macro, $.macro_call, $.string_literal))),
    ),

    string_literal: $ => seq(
      choice('L"', '"'),
      repeat(choice(
        token.immediate(prec(1, /[^\\"\n]+/)),
        $.escape_sequence
      )),
      '"',
    ),

    escape_sequence: $ => token.immediate(seq(
      '\\',
      choice(
        /[^xuU]/,
        /\d{2,3}/,
        /x[0-9a-fA-F]{2,}/,
        /u[0-9a-fA-F]{4}/,
        /U[0-9a-fA-F]{8}/
      )
    )),

    system_lib_string: $ => token(seq(
      '<',
      repeat(choice(/[^>\n]/, '\\>')),
      '>'
    )),

    true: $ => token(choice('TRUE', 'true')),
    false: $ => token(choice('FALSE', 'false')),
    null: $ => 'NULL',

    identifier: $ => /[a-zA-Z_]\w*/,

    _type_identifier: $ => alias($.identifier, $.type_identifier),
    _field_identifier: $ => alias($.identifier, $.field_identifier),
    _statement_identifier: $ => alias($.identifier, $.statement_identifier),

    _empty_declaration: $ => seq(
      $._type_specifier,
      ';'
    ),

    // http://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment/36328890#36328890
    comment: $ => token(choice(
      seq('//', /(\\(.|\r?\n)|[^\\\n])*/),
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
      '/'
    )
    )),
  },

  supertypes: $ => [
    $._expression,
    $._statement,
    $._type_specifier,
    $._declarator,
    $._field_declarator,
    $._type_declarator,
    $._abstract_declarator,
  ]
});

module.exports.PREC = PREC

function preprocIf (suffix, content) {
  function elseBlock ($) {
    return choice(
      suffix ? alias($['preproc_else' + suffix], $.preproc_else) : $.preproc_else,
      suffix ? alias($['preproc_elif' + suffix], $.preproc_elif) : $.preproc_elif,
    );
  }

  return {
    ['preproc_if' + suffix]: $ => seq(
      preprocessor('if'),
      field('condition', $.preproc_condition),
      repeat(content($)),
      field('alternative', optional(elseBlock($))),
      preprocessor('endif')
    ),

    ['preproc_ifdef' + suffix]: $ => seq(
      choice(preprocessor('ifdef'), preprocessor('ifndef')),
      field('name', choice($.macro, $.identifier)),
      repeat(content($)),
      field('alternative', optional(elseBlock($))),
      preprocessor('endif')
    ),

    ['preproc_else' + suffix]: $ => seq(
      preprocessor('else'),
      repeat(content($))
    ),

    ['preproc_elif' + suffix]: $ => seq(
      preprocessor('elif'),
      field('condition', $.preproc_condition),
      repeat(content($)),
      field('alternative', optional(elseBlock($))),
    )
  }
}

function preprocessor (command) {
  return alias(new RegExp('#[ \t]*' + command), '#' + command)
}

function commaSep (rule) {
  return optional(commaSep1(rule))
}

function commaSep1 (rule) {
  return seq(rule, repeat(seq(',', rule)))
}

function commaSepTrailing (recurSymbol, rule) {
  return choice(rule, seq(recurSymbol, ',', rule))
}
