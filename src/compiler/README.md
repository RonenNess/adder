# Compiler

This module is responsible to take raw code (string) and convert it to an AST the interpreter then read and parse.
The Compiler is made from 3 components:

1. lexer: convert code into a list of tokens.
2. parser: convert tokens into an AST.
3. compiler: tie the components together and provide the API of the compiler class.

In addition, you can see different compiler flags you can set in default_flags.js.