
import {parse} from '@babel/parser';
import generate from '@babel/generator';
import * as fsPromises from 'node:fs/promises';
import * as path from 'path';
import {fileURLToPath} from 'url';
import {AstFile} from './AstFile.js';


export class SplitWebExtension {
  constructor() {
    this.errors = [];
    this.userAgent = null;
    this.srcDir = '.';
  }

  parse(code) {
    this.ast = parse(code, {sourceType: "module"});
//console.log(JSON.stringify(this.ast,null,4));
  }

  clearFiles() {
    this.astFiles = {
      background: new AstFile(),
      content: new AstFile(),
      options: new AstFile(),
      browser: new AstFile(),
      popup: new AstFile(),
    };

    //    console.log('ast json', JSON.stringify(this.ast, null, 4));
  }

  setUserAgent(userAgent) {
    this.userAgent = userAgent;
  }

  getScriptTypes() {
    return Object.keys(this.astFiles);
  }

  addError(err) {
    this.errors.push(err);
  }

  clearErrors() {
    this.errors = [];
  }

  printErrors() {
    if (this.errors.length > 0) {
      console.error(this.errors.join('\n'));
    }
  }

  processOptionsFromComments(ast) {
    const options = {};
    this.getOptionsFromComments(ast, (comment, m, m1, m2) => {
      const nv = /^([^=]+)=(.*)$/.exec(m2);

      if (nv === null) {
        options.scriptType = m2;
        options.scriptTypes = m2.split(',').reduce(
          (a, b) => {
            if (b) {
              if (!this.astFiles[b]) {
                this.addError(`Unknown script type: ${b} line: ${comment.loc.start.line}`);
              } else {
                a[b] = true;
              }
            }
            return a;
          },
          {});
      } else {
        options[nv[1]] = nv[2];
      }

      // return `${m1}_parsed: ${m2}`;
      return m;
    });
    return options;
  }

  getOptionsFromComments(ast, func) {
    if (!ast.leadingComments
      || ast.leadingComments.length === 0
    ) {
      return;
    }

    ast.leadingComments.forEach((comment /*, idx */) => {
      comment.value = comment.value.replace(/(simplewebext)\s+(\S+)/g, (m, m1, m2) => {
        return func(comment, m, m1, m2);
      });
//      ast.leadingComments[idx] = comment;
    });
  }

  addCall(className, functionAst, destClassAsts) {
    const fShortName = AstFile.getFunctionAstName(functionAst);
    const fName = AstFile.getFullFunctionAstName(className, functionAst);
    if (fName === null) {
      console.error('Cannot find function name', JSON.stringify(functionAst, null, 4));
      return null;
    }

//    if(functionAst.type === 'ClassMethod' && !functionAst.static) {
//      this.addError(`Not a static function, "this" will not be passed.  ${fName}, line: ${functionAst.start}`);
//    }
    // Console.log('func ast', JSON.stringify(functionAst, null, 4));
    if (
      functionAst.type !== 'ClassMethod'
      && functionAst.type !== 'FunctionDeclaration'
    ) {
      console.log('Unsupported type', functionAst.type);
      return null;
    }

    const isStatic = functionAst.static;
    const options = this.processOptionsFromComments(functionAst);
    const scriptTypesCount = options.scriptTypes ? Object.keys(options.scriptTypes) : 0;
    if (!options.scriptTypes || scriptTypesCount === 0) {
      // function to run on all scripts
      this.checkAstForComments(functionAst.body);

      this.addToScriptTypes(options, functionAst, destClassAsts);
    } else if (scriptTypesCount > 1) {
      this.addError(`Function cannot have more than one script type.  ${fName}, line: ${functionAst.start}, scriptTypes: ${options.scriptType}`);
    } else {
      const scriptType = options.scriptType;

      let callAst;
      // convert function to a call via message to another script.
      if (isStatic) {
        callAst = parse(`() => { return simpleWebExt.${scriptType}.apply(simpleWebExt, ["${fName}", ...arguments]); }`, {sourceType: "module"});
      } else {
        callAst = parse(`() => { return simpleWebExt.${scriptType}.apply(simpleWebExt, ["${fName}", this, ...arguments]).then((result) => { if(!result) return null; if(result.newThis) Object.assign(this, result.newThis); return result.result; }); }`, {sourceType: "module"});
      }

      const newCallAst = {...functionAst};
      newCallAst.body = {...functionAst.body};
      newCallAst.body.body = callAst.program.body[0].expression.body.body;

      const astFile = this.astFiles[scriptType];
      if (!astFile) {
        this.addError(`Unknown script type line:${functionAst.start}, scriptType:${scriptType}`);
      } else {
        astFile.addMessageFunction(className, fShortName, functionAst);
      }

      this.checkAstForComments(functionAst.body);

      // eslint-disable-next-line guard-for-in
      for (const sType in destClassAsts) {
        const destClassAst = destClassAsts[sType];

        if (!scriptType || scriptType === sType) {
          AstFile.addToAstBody(destClassAst, functionAst);
        } else {
          AstFile.addToAstBody(destClassAst, newCallAst);
        }
      }
    }

    return {functionAst, options};
  }

  addToScriptTypes(options, body, destClassAsts) {
    let scriptTypes = options.scriptTypes;
    const userAgent = options.userAgent;

    if (!scriptTypes || !Object.keys(scriptTypes)) {
      // no type defined, add to all
      scriptTypes = this.astFiles;
    }

    // browser
    if (userAgent && this.userAgent !== userAgent) {
      return;
    }
    // eslint-disable-next-line guard-for-in
    for (const sType in scriptTypes) {
      AstFile.addToAstBody(destClassAsts[sType], body);
    }
  }

  checkAstForComments(ast) {
    if(Array.isArray(ast)) {
      for (const b of ast) {
        this.checkAstForComments(b);
      }
      return;
    } 

    let optionsCount=0;
    this.getOptionsFromComments(ast, () => { ++optionsCount; });
    if(optionsCount > 0) {
      this.addError('Has simplewebext comment in the wrong place, line:' + ast.loc.start.line);
    }

    if(ast.expression) {
      return this.checkAstForComments(ast.expression);
    } 
    if(ast.argument) {
      return this.checkAstForComments(ast.argument);
    } 
    if(ast.arguments) {
      return this.checkAstForComments(ast.arguments);
    } 
    if(ast.body) {
      return this.checkAstForComments(ast.body);
    } 

    return;
  }

  splitFunctionsToFiles(className, classAst, destClassAsts) {
    let body = Array.isArray(classAst.body) ? classAst.body : null;
    if (!body && classAst.body && Array.isArray(classAst.body.body)) {
      body = classAst.body.body;
    }

    if (!body) {
      return;
    }

    for (const b of body) {
      if (b.type === 'ClassDeclaration') {
        const classOptions = this.processOptionsFromComments(b);
        if (classOptions.scriptType) {
          this.addToScriptTypes(classOptions, b, destClassAsts);
          continue;
        }

        className = b.id.name;

        // we have not defined a class, let's
        const newDestClassAsts = {};

        // eslint-disable-next-line guard-for-in
        for (const sType in destClassAsts) {
          const newDestClassAst = {...b};
          newDestClassAst.body = {...b.body};
          newDestClassAst.body.body = [];
          newDestClassAsts[sType] = newDestClassAst;
          AstFile.addToAstBody(destClassAsts[sType], newDestClassAst);
        }

        this.splitFunctionsToFiles(className, b, newDestClassAsts);
      } else if (b.type === 'ClassMethod' || b.type === 'FunctionDeclaration') {
        this.addCall(className, b, destClassAsts);
      } else {
        const classOptions = this.processOptionsFromComments(b);
        this.checkAstForComments(b);
        this.addToScriptTypes(classOptions, b, destClassAsts);
      }
    }
  }

  splitToFiles() {
    this.clearFiles();
    const destClassAsts = {};

    // eslint-disable-next-line guard-for-in
    for (const n in this.astFiles) {
      const destClassAst = {...this.ast};
      destClassAst.program = {...this.ast.program};
      destClassAst.program.body = [];
      destClassAsts[n] = destClassAst;
    }

    this.destClassAsts = destClassAsts;

    return this.splitFunctionsToFiles('', this.ast.program, destClassAsts);
  }

  generate(destDir, scriptGlobalId, code) {
    let promise = Promise.resolve(true);
    // eslint-disable-next-line guard-for-in
    for (const n in this.astFiles) {
      const astFile = this.astFiles[n];

      const astFileInfo = astFile.makeAst(n, scriptGlobalId);
      if (!astFileInfo) {
        continue;
      }

      // @babel/generator does not have generate.default in svelte
      // In node, generate is a class, generate.default is a function
      const fString = (generate.default || generate )(
        this.destClassAsts[n],
        {
          /* Options */
        },
        code,
      ).code;

      const nUcFirst = AstFile.capitalize(n);

      const dirname = path.dirname(fileURLToPath(import.meta.url));
      const js = `import {WebExtension${nUcFirst}} from '${dirname}/../lib/${n}.js';`
        + "import {SimpleWebExtensionUtil} from 'SimpleWebExtensionUtil';\n"
        + "const browser = SimpleWebExtensionUtil.getBrowser();\n"
        + `\n/////////////\n// ${n}\n\n`
        + `${astFileInfo.init}\n${fString}\n${astFileInfo.body}`
      ;
    
      const destFile = path.join(destDir, n + '.js');
      promise = promise.then(fsPromises.writeFile(destFile, js));
    }

    return promise;
  }
}

