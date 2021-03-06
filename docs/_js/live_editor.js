var IS_MOBILE = (
  navigator.userAgent.match(/Android/i)
    || navigator.userAgent.match(/webOS/i)
    || navigator.userAgent.match(/iPhone/i)
    || navigator.userAgent.match(/iPad/i)
    || navigator.userAgent.match(/iPod/i)
    || navigator.userAgent.match(/BlackBerry/i)
    || navigator.userAgent.match(/Windows Phone/i)
);

var CodeMirrorEditor = createReactClass({
  propTypes: {
    lineNumbers: PropTypes.bool,
    onChange: PropTypes.func,
  },
  getDefaultProps: function() {
    return {
      lineNumbers: false,
    };
  },
  componentDidMount: function() {
    if (IS_MOBILE) return;

    this.editor = CodeMirror.fromTextArea(this.refs.editor, {
      mode: 'jsx',
      lineNumbers: this.props.lineNumbers,
      lineWrapping: true,
      smartIndent: false,  // javascript mode does bad things with jsx indents
      matchBrackets: true,
      theme: 'solarized-light',
      readOnly: this.props.readOnly,
    });
    this.editor.on('change', this.handleChange);
  },

  componentDidUpdate: function() {
    if (this.props.readOnly) {
      this.editor.setValue(this.props.codeText);
    }
  },

  handleChange: function() {
    if (!this.props.readOnly) {
      this.props.onChange && this.props.onChange(this.editor.getValue());
    }
  },

  render: function() {
    // wrap in a div to fully contain CodeMirror
    var editor;

    if (IS_MOBILE) {
      editor = <pre style={{overflow: 'scroll'}}>{this.props.codeText}</pre>;
    } else {
      editor = <textarea ref="editor" defaultValue={this.props.codeText} />;
    }

    return (
      <div style={this.props.style} className={this.props.className}>
        {editor}
      </div>
    );
  },
});

var selfCleaningTimeout = {
  componentDidUpdate: function() {
    clearTimeout(this.timeoutID);
  },

  setTimeout: function() {
    clearTimeout(this.timeoutID);
    this.timeoutID = setTimeout.apply(null, arguments);
  },
};

var ReactPlayground = createReactClass({
  mixins: [selfCleaningTimeout],

  MODES: {JSX: 'JSX', JS: 'JS'}, //keyMirror({JSX: true, JS: true}),

  propTypes: {
    codeText: PropTypes.string.isRequired,
    transformer: PropTypes.func,
    renderCode: PropTypes.bool,
    showCompiledJSTab: PropTypes.bool,
    showLineNumbers: PropTypes.bool,
    editorTabTitle: PropTypes.string,
  },

  getDefaultProps: function() {
    return {
      transformer: function(code, options) {
        var presets = ['react'];
        if (!options || !options.skipES2015Transform) {
          presets.push('es2015');
        }
        return Babel.transform(code, {
          presets
        }).code;
      },
      editorTabTitle: 'Live JSX Editor',
      showCompiledJSTab: true,
      showLineNumbers: false,
    };
  },

  getInitialState: function() {
    return {
      mode: this.MODES.JSX,
      code: this.props.codeText,
    };
  },

  handleCodeChange: function(value) {
    this.setState({code: value});
    this.executeCode();
  },

  handleCodeModeSwitch: function(mode) {
    this.setState({mode: mode});
  },

  compileCode: function(options) {
    return this.props.transformer(this.state.code, options);
  },

  render: function() {
    var isJS = this.state.mode === this.MODES.JS;
    var compiledCode = '';
    try {
      compiledCode = this.compileCode({skipES2015Transform: true});
    } catch (err) {}

    var JSContent =
      <CodeMirrorEditor
        key="js"
        className="playgroundStage CodeMirror-readonly"
        onChange={this.handleCodeChange}
        codeText={compiledCode}
        readOnly={true}
        lineNumbers={this.props.showLineNumbers}
      />;

    var JSXContent =
      <CodeMirrorEditor
        key="jsx"
        onChange={this.handleCodeChange}
        className="playgroundStage"
        codeText={this.state.code}
        lineNumbers={this.props.showLineNumbers}
      />;

    var JSXTabClassName =
      'playground-tab' + (isJS ? '' : ' playground-tab-active');
    var JSTabClassName =
      'playground-tab' + (isJS ? ' playground-tab-active' : '');

    var JSTab =
      <div
        className={JSTabClassName}
        onClick={this.handleCodeModeSwitch.bind(this, this.MODES.JS)}>
          Compiled JS
      </div>;

    var JSXTab =
      <div
        className={JSXTabClassName}
        onClick={this.handleCodeModeSwitch.bind(this, this.MODES.JSX)}>
          {this.props.editorTabTitle}
      </div>

    return (
      <div className="playground">
        <div>
          {JSXTab}
          {this.props.showCompiledJSTab && JSTab}
        </div>
        <div className="playgroundCode">
          {isJS ? JSContent : JSXContent}
        </div>
        <div className="playgroundPreview">
          <div ref="mount" />
        </div>
      </div>
    );
  },

  componentDidMount: function() {
    this.executeCode();
  },

  componentDidUpdate: function(prevProps, prevState) {
    // execute code only when the state's not being updated by switching tab
    // this avoids re-displaying the error, which comes after a certain delay
    if (this.props.transformer !== prevProps.transformer ||
        this.state.code !== prevState.code) {
      this.executeCode();
    }
  },

  executeCode: function() {
    var mountNode = this.refs.mount;

    try {
      ReactDOM.unmountComponentAtNode(mountNode);
    } catch (e) { }

    try {
      var compiledCode;
      if (this.props.renderCode) {
        compiledCode = this.compileCode({skipES2015Transform: true});
        ReactDOM.render(
          <CodeMirrorEditor codeText={compiledCode} readOnly={true} />,
          mountNode
        );
      } else {
        compiledCode = this.compileCode({skipES2015Transform: false});
        eval(compiledCode);
      }
    } catch (err) {
      // Babel errors are preformatted, runtime errors are not.
      const errorMessage = err._babel ?
        <pre style={{overflowX: 'auto'}} className="playgroundError">{err.toString()}</pre> :
        <div className="playgroundError">{err.toString()}</div>;
      this.setTimeout(function() {
        ReactDOM.render(
          errorMessage,
          mountNode
        );
      }, 500);
    }
  },
});
