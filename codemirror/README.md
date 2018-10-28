# codemirror files

Use the files here with Codemirror to create an editor with coloring and auto-complete for Adder.

Usage example:

```JavaScript
CodeMirror.commands.autocomplete = function(cm) {
	cm.showHint();
}
var editor = CodeMirror.fromTextArea(document.getElementById('code'), {
	lineNumbers: true,
	textWrapping: false,
	indentUnit: 4,
	parserConfig: {'pythonVersion': 2, 'strictErrors': true},
	extraKeys: {"Ctrl-Space": "autocomplete"},
});
```

For more info, see `/examples/sandbox.html`.