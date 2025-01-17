const C = require("../tree-sitter-c/grammar")

const PREC = Object.assign(C.PREC, {
  LAMBDA: 18,
  NEW: C.PREC.CALL + 1,
})

module.exports = grammar(C, {
  name: 'cpp',

  externals: $ => [
    $.raw_string_literal,
  ],

  conflicts: ($, original) => original.concat([
    [$.template_function, $.template_type],
    [$.template_function, $.template_type, $._expression],
    [$.template_function, $._expression],
    [$.template_method, $.template_type, $.field_expression],
    [$._type_specifier, $.template_type],
    [$.scoped_type_identifier, $.scoped_identifier],
    [$.scoped_type_identifier, $.scoped_field_identifier],
    [$.comma_expression, $.initializer_list],
    [$._type_specifier, $.optional_type_parameter_declaration],
    [$._expression, $._declarator],
    [$._expression, $.structured_binding_declarator],
    [$._expression, $._declarator, $._type_specifier],
    [$.parameter_list, $.argument_list],
    [$._declaration_specifiers_no_type, $.constructor_or_destructor_definition],
    [$._declaration_specifiers, $._declaration_specifiers_no_type, $.constructor_or_destructor_definition],
    [$._declaration_specifiers, $._declaration_specifiers_no_type, $._declarator, $.constructor_or_destructor_definition],
    [$._declaration_specifiers, $._declaration_specifiers_no_type, $._declarator, $._expression, $.constructor_or_destructor_definition],
    [$._declaration_specifiers, $._declaration_specifiers_no_type, $._expression, $.constructor_or_destructor_definition],
    [$._declarator],
    [$._declaration_specifiers, $._declarator, $.constructor_or_destructor_definition],
    [$.pointer_declarator, $._expression],
    [$._declarator, $.pointer_declarator, $._expression],
    [$._declarator, $.pointer_declarator],
  ]),

  inline: ($, original) => original.concat([
    $._namespace_identifier,
    $._class_name,
  ]),

  rules: {
    _top_level_item: ($, original) => choice(
      original,
      $.namespace_definition,
      $.using_declaration,
      $.alias_declaration,
      $.template_declaration,
      $.template_instantiation,
      // $.structured_binding_declaration,
      alias($.constructor_or_destructor_definition, $.function_definition)
    ),

    // Types

    _type_specifier: ($, original) => choice(
      original,
      $.class_specifier,
      $.scoped_type_identifier,
      $.template_type,
      $.auto,
      $.dependent_type
    ),

    type_qualifier: ($, original) => choice(
      original,
      'mutable',
      'explicit',
      'constexpr'
    ),

    // When used in a trailing return type, these specifiers can now occur immediately before
    // a compound statement. This introduces a shift/reduce conflict that needs to be resolved
    // with an associativity.
    class_specifier: $ => prec.right(seq(
      'class',
      choice(
        field('name', $._class_name),
        seq(
          optional(field('name', $._class_name)),
          optional($.virtual_specifier),
          optional($.base_class_clause),
          field('body', $.field_declaration_list)
        )
      )
    )),

    union_specifier: $ => prec.right(seq(
      'union',
      choice(
        field('name', $._class_name),
        seq(
          optional(field('name', $._class_name)),
          optional($.virtual_specifier),
          optional($.base_class_clause),
          field('body', $.field_declaration_list)
        )
      )
    )),

    struct_specifier: $ => prec.right(seq(
      'struct',
      choice(
        field('name', $._class_name),
        seq(
          optional(field('name', $._class_name)),
          optional($.virtual_specifier),
          optional($.base_class_clause),
          field('body', $.field_declaration_list)
        )
      )
    )),

    _class_name: $ => choice(
      $._type_identifier,
      $.scoped_type_identifier,
      $.template_type
    ),

    virtual_specifier: $ => choice(
      'final', // the only legal value here for classes
      'override' // legal for functions in addition to final, plus permutations.
    ),

    virtual_function_specifier: $ => choice(
      'virtual'
    ),

    base_class_clause: $ => seq(
      ':',
      commaSep1(seq(
        optional(choice('public', 'private', 'protected')),
        $._class_name
      ))
    ),

    enum_specifier: ($, original) => prec.left(original),

    // The `auto` storage class is removed in C++0x in order to allow for the `auto` type.
    storage_class_specifier: ($, original) => choice(
      ...original.members.filter(member => member.value !== 'auto')
    ),

    auto: $ => 'auto',

    dependent_type: $ => prec.dynamic(-1, seq(
      'typename',
      $._type_specifier
    )),

    // Declarations

    function_definition: ($, original) => seq(
      repeat($.attribute),
      original
    ),

    declaration: ($, original) => seq(
      repeat($.attribute),
      original
    ),

    template_declaration: $ => seq(
      'template',
      field('parameters', $.template_parameter_list),
      choice(
        $.declaration,
        $._empty_declaration,
        $.function_definition
      )
    ),

    template_instantiation: $ => seq(
      'template',
      optional($._declaration_specifiers),
      field('declarator', $._declarator),
      ';'
    ),

    template_parameter_list: $ => seq(
      '<',
      commaSep(choice(
        $.parameter_declaration,
        $.optional_parameter_declaration,
        $.type_parameter_declaration,
        $.variadic_type_parameter_declaration,
        $.optional_type_parameter_declaration
      )),
      alias(token(prec(1, '>')), '>')
    ),

    parameter_declaration: ($, original) => seq(
      repeat($.attribute),
      original
    ),

    type_parameter_declaration: $ => prec(1, seq(
      choice('typename', 'class'),
      $._type_identifier
    )),

    variadic_type_parameter_declaration: $ => prec(1, seq(
      choice('typename', 'class'),
      '...',
      $._type_identifier
    )),

    optional_type_parameter_declaration: $ => seq(
      'typename',
      field('name', $._type_identifier),
      '=',
      field('default_type', $._type_specifier)
    ),

    parameter_list: $ => seq(
      '(',
      commaSep(choice(
        $.parameter_declaration,
        $.optional_parameter_declaration,
        $.variadic_parameter_declaration,
        '...'
      )),
      ')'
    ),

    optional_parameter_declaration: $ => seq(
      $._declaration_specifiers,
      field('declarator', optional($._declarator)),
      '=',
      field('default_value', $._expression)
    ),

    variadic_parameter_declaration: $ => seq(
      $._declaration_specifiers,
      field('declarator', choice(
        $.variadic_declarator,
        alias($.variadic_reference_declarator, $.reference_declarator)
      ))
    ),

    variadic_declarator: $ => seq(
      '...',
      $.identifier
    ),

    variadic_reference_declarator: $ => seq(
      choice('&&', '&'),
      $.variadic_declarator
    ),

    init_declarator: ($, original) => choice(
      original,
      seq(
        field('declarator', $._declarator),
        field('value', choice(
          $.argument_list,
          $.initializer_list
        ))
      )
    ),

    // Avoid ambiguity between compound statement and initializer list in a construct like:
    //   A b {};
    compound_statement: ($, original) => prec(-1, original),

    field_initializer_list: $ => seq(
      ':',
      commaSep1($.field_initializer)
    ),

    field_initializer: $ => prec(1, seq(
      choice($._field_identifier, $.scoped_field_identifier),
      choice($.initializer_list, $.argument_list)
    )),

    _field_declaration_list_item: ($, original) => choice(
      original,
      $.template_declaration,
      alias($.inline_method_definition, $.function_definition),
      alias($.constructor_or_destructor_definition, $.function_definition),
      alias($.constructor_or_destructor_declaration, $.declaration),
      $.friend_declaration,
      $.access_specifier,
      $.alias_declaration,
      $.using_declaration,
      $.type_definition,
      seq($.macro, '\n'),
      seq($.macro_call, '\n'),
    ),

    field_declaration: $ => seq(
      repeat($.attribute),
      optional($.virtual_function_specifier),
      choice($._declaration_specifiers, $._declaration_specifiers_no_type),
      optional($.call_convention),
      commaSep(field('declarator', $._field_declarator)),
      optional(choice(
        $.bitfield_clause,
        field('default_value', $.initializer_list),
        seq('=', field('default_value', choice($._expression, $.initializer_list)))
      )),
      ';'
    ),

    inline_method_definition: $ => seq(
      repeat($.attribute),
      optional($.virtual_function_specifier),
      choice($._declaration_specifiers, $._declaration_specifiers_no_type),
      optional($.call_convention),
      field('declarator', $._field_declarator),
      choice(
        field('body', $.compound_statement),
        $.delete_method_clause
      )
    ),

    constructor_or_destructor_definition: $ => seq(
      repeat(choice(
        $.macro,
        $.macro_call,
        $.storage_class_specifier,
        $.type_qualifier,
        $.attribute_specifier,
      )),
      prec(1, seq(
        optional($.virtual_function_specifier),
        optional($.call_convention),
        field('declarator', $.function_declarator),
        optional($.field_initializer_list)
      )),
      choice(
        field('body', $.compound_statement),
        $.default_method_clause,
        $.delete_method_clause,
      )
    ),

    constructor_or_destructor_declaration: $ => seq(
      optional($.virtual_function_specifier),
      optional($.call_convention),
      field('declarator', $.function_declarator),
      ';'
    ),

    default_method_clause: $ => seq('=', 'default', ';'),
    delete_method_clause: $ => seq('=', 'delete', ';'),

    friend_declaration: $ => seq(
      'friend',
      choice(
        $.declaration,
        $.function_definition,
        seq($.class_specifier, ';')
      )
    ),

    access_specifier: $ => seq(
      choice(
        'public',
        'private',
        'protected'
      ),
      ':'
    ),

    _declarator: ($, original) => choice(
      original,
      $.reference_declarator,
      $.scoped_identifier,
      $.template_function,
      $.operator_name,
      $.destructor_name,
      $.structured_binding_declarator
    ),

    _field_declarator: ($, original) => choice(
      original,
      alias($.reference_field_declarator, $.reference_declarator),
      $.template_method,
      $.operator_name
    ),

    _abstract_declarator: ($, original) => choice(
      original,
      $.abstract_reference_declarator
    ),

    reference_declarator: $ => prec.dynamic(1, prec.right(seq(choice('&', '&&'), $._declarator))),
    reference_field_declarator: $ => prec.dynamic(1, prec.right(seq(choice('&', '&&'), $._field_declarator))),
    abstract_reference_declarator: $ => prec.right(seq(choice('&', '&&'), optional($._abstract_declarator))),

    // structured_binding_reference_declarator: $ => seq(choice('&', '&&'), $.structured_binding_declarator),
    structured_binding_declarator: $ => seq('[', commaSep1($.identifier), ']'),

    function_declarator: ($, original) => seq(
      original,
      repeat(choice(
        $.type_qualifier,
        $.virtual_specifier,
        $.noexcept,
        $.throw_specifier,
        $.trailing_return_type
      ))
    ),

    function_field_declarator: ($, original) => seq(
      original,
      repeat(choice(
        $.type_qualifier,
        $.virtual_specifier,
        $.noexcept,
        $.throw_specifier,
        $.trailing_return_type
      ))
    ),

    abstract_function_declarator: ($, original) => prec.right(seq(
      original,
      repeat(choice(
        $.type_qualifier,
        $.noexcept,
        $.throw_specifier,
      )),
      optional($.trailing_return_type)
    )),

    trailing_return_type: $ => prec.right(seq(
      '->',
      $._type_specifier,
      optional($._abstract_declarator)
    )),

    noexcept: $ => prec.right(seq(
      'noexcept',
      optional(
        seq(
          '(',
          optional($._expression),
          ')',
        ),
      ),
    )),

    throw_specifier: $ => seq(
      'throw',
      seq(
        '(',
        commaSep($.type_descriptor),
        ')',
      )
    ),

    template_type: $ => seq(
      field('name', choice($._type_identifier, $.scoped_type_identifier)),
      field('arguments', $.template_argument_list)
    ),

    template_method: $ => seq(
      field('name', choice($._field_identifier, $.scoped_field_identifier)),
      field('arguments', $.template_argument_list)
    ),

    template_function: $ => seq(
      field('name', choice($.identifier, $.scoped_identifier)),
      field('arguments', $.template_argument_list)
    ),

    template_argument_list: $ => seq(
      '<',
      commaSep(choice(
        prec.dynamic(2, $.type_descriptor),
        prec.dynamic(1, $._expression)
      )),
      alias(token(prec(1, '>')), '>')
    ),

    namespace_definition: $ => seq(
      'namespace',
      field('name', optional($.identifier)),
      field('body', $.declaration_list)
    ),

    using_declaration: $ => seq(
      'using',
      optional('namespace'),
      choice(
        $.identifier,
        $.scoped_identifier
      ),
      ';'
    ),

    alias_declaration: $ => seq(
      'using',
      field('name', $._type_identifier),
      '=',
      field('type', $.type_descriptor),
      ';'
    ),

    // Statements

    _statement: ($, original) => choice(
      original,
      $.for_range_loop,
      $.try_statement,
      $.throw_statement,
    ),

    if_statement: $ => prec.right(seq(
      'if',
      optional('constexpr'),
      field('condition', $.parenthesized_expression),
      field('consequence', $._statement),
      optional(seq(
        'else',
        field('alternative', $._statement)
      ))
    )),

    for_range_loop: $ => seq(
      'for',
      '(',
      $._declaration_specifiers,
      field('declarator', $._declarator),
      ':',
      field('right', choice(
        $._expression,
        $.initializer_list,
      )),
      ')',
      field('body', $._statement)
    ),

    return_statement: ($, original) => choice(
      original,
      seq('return', $.initializer_list, ';')
    ),

    throw_statement: $ => seq(
      'throw',
      optional($._expression),
      ';'
    ),

    try_statement: $ => seq(
      'try',
      field('body', $.compound_statement),
      repeat1($.catch_clause)
    ),

    catch_clause: $ => seq(
      'catch',
      field('parameters', $.parameter_list),
      field('body', $.compound_statement)
    ),

    attribute: $ => seq(
      '[[',
      commaSep1($._expression),
      ']]'
    ),

    // Expressions

    _expression: ($, original) => choice(
      original,
      $.template_function,
      $.scoped_identifier,
      $.new_expression,
      $.delete_expression,
      $.lambda_expression,
      $.nullptr,
      $.raw_string_literal
    ),

    new_expression: $ => prec.right(PREC.NEW, seq(
      'new',
      field('placement', optional($.argument_list)),
      field('type', $._type_specifier),
      field('declarator', optional($.new_declarator)),
      field('arguments', optional(choice(
        $.argument_list,
        $.initializer_list
      )))
    )),

    new_declarator: $ => prec.right(seq(
      '[',
      field('length', $._expression),
      ']',
      optional($.new_declarator)
    )),

    delete_expression: $ => seq(
      optional('::'),
      'delete',
      optional(seq('[', ']')),
      $._expression
    ),

    field_expression: ($, original) => choice(
      original,
      seq(
        prec(PREC.FIELD, seq(
          field('argument', $._expression),
          choice('.', '->')
        )),
        field('field', choice(
          $.destructor_name,
          $.template_method
        ))
      )
    ),

    lambda_expression: $ => seq(
      field('captures', $.lambda_capture_specifier),
      field('declarator', $.abstract_function_declarator),
      field('body', $.compound_statement)
    ),

    lambda_capture_specifier: $ => prec(PREC.LAMBDA, seq(
      '[',
      choice(
        $.lambda_default_capture,
        commaSep($._expression)
      ),
      ']'
    )),

    lambda_default_capture: $ => choice('=', '&'),

    argument_list: $ => seq(
      '(',
      commaSep(choice($._expression, $.initializer_list)),
      ')'
    ),

    destructor_name: $ => prec(1, seq('~', $.identifier)),

    compound_literal_expression: ($, original) => choice(
      original,
      seq(
        field('type', choice(
          $._type_identifier,
          $.template_type,
          $.scoped_type_identifier
        )),
        field('value', $.initializer_list)
      )
    ),

    scoped_field_identifier: $ => prec(1, seq(
      field('namespace', optional(choice(
        $._namespace_identifier,
        $.template_type,
        $.scoped_namespace_identifier
      ))),
      '::',
      field('name', choice(
        $._field_identifier,
        $.operator_name,
        $.destructor_name
      ))
    )),

    scoped_identifier: $ => prec(1, seq(
      field('namespace', optional(choice(
        $._namespace_identifier,
        $.template_type,
        $.scoped_namespace_identifier
      ))),
      '::',
      field('name', choice(
        $.identifier,
        $.operator_name,
        $.destructor_name,
        $.macro,
      ))
    )),

    scoped_type_identifier: $ => prec(1, seq(
      field('namespace', optional(choice(
        $._namespace_identifier,
        $.template_type,
        $.scoped_namespace_identifier
      ))),
      '::',
      field('name', $._type_identifier)
    )),

    scoped_namespace_identifier: $ => prec(2, seq(
      field('namespace', optional(choice(
        $._namespace_identifier,
        $.template_type,
        $.scoped_namespace_identifier
      ))),
      '::',
      field('name', $._namespace_identifier)
    )),

    operator_name: $ => token(seq(
      'operator',
      choice(
        '+', '-', '*', '/', '%',
        '^', '&', '|', '~',
        '!', '=', '<', '>',
        '+=', '-=', '*=', '/=', '%=', '^=', '&=', '|=',
        '<<', '>>', '>>=', '<<=',
        '==', '!=', '<=', '>=',
        '&&', '||',
        '++', '--',
        ',',
        '->*',
        '->',
        '()', '[]'
      )
    )),

    string_literal: $ => seq(
      choice('L"', 'u"', 'U"', 'u8"', '"'),
      repeat(choice(
        token.immediate(prec(1, /[^\\"\n]+/)),
        $.escape_sequence
      )),
      '"',
    ),

    char_literal: $ => seq(
      choice('L\'', 'u\'', 'U\'', 'u8\'', '\''),
      choice(
        $.escape_sequence,
        token.immediate(/[^\n']/)
      ),
      '\''
    ),

    nullptr: $ => 'nullptr',

    _namespace_identifier: $ => alias($.identifier, $.namespace_identifier),

    macro_type_specifier: $ => choice(),
  }
});

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}
