
import { strict as assert } from 'node:assert';

export class AstFile {
  constructor() {
    this.messageFunctions = [];
  }

  addMessageFunction(className, funcName, func) {
    assert.ok(func ? true: false);
    assert.ok(funcName ? true: false);
    this.messageFunctions.push({func, className, funcName});
  }

  static getAstBody(classAst) {
    let body = Array.isArray(classAst.body) ? classAst.body : null;
    if (!body && classAst.body && Array.isArray(classAst.body.body)) {
      body = classAst.body.body;
    }

    if (!body && classAst.program && Array.isArray(classAst.program.body)) {
      body = classAst.program.body;
    }

    return body;
  }

  static addToAstBody(classAst, ast) {
    const body = AstFile.getAstBody(classAst);
    body.push(ast);
  }

  static capitalize(scriptType) {
    return scriptType.substring(0, 1).toUpperCase() + scriptType.substring(1);
  }

  getFileTypeClassInit(scriptType, name) {
    const scriptTypeUcFirst = AstFile.capitalize(scriptType);
    return `\n\nconst simpleWebExt = new WebExtension${scriptTypeUcFirst}('${name}');\n`;
  }

  static getFunctionAstName(func) {
    let fName = null;
    if (func.key) {
      fName = func.key.name;
    }

    if (func.id) {
      fName = func.id.name;
    }

    return fName;
  }

  static getFullFunctionAstName(className, func) {
    const fName = this.getFunctionAstName(func);
    if (fName === null) {
      return null;
    }

    return `${className}__${fName}`;
  }

  makeAst(scriptType, scriptGlobalId) {
    if (this.messageFunctions.length === 0) {
      return null;
    }
    const createSimpleWebExt = this.getFileTypeClassInit(scriptType, scriptGlobalId);

    let functionsStr = '';

    for (const functionObj of this.messageFunctions) {
      const {className, funcName, func} = functionObj;

      //      F.type = 'FunctionExpression';

      let className2 = className;
      let classObject;
      if (className2 !== '') {
        classObject = className;
        className2 += '.';
      } else {
        classObject = 'window';
      }

      if (func.static || func.type === 'FunctionDeclaration') {
        functionsStr += `\t${className}__${funcName} () {`
          + `return ${className2}${funcName}.apply(${classObject}, arguments);`
          + `},\n`;
      } else {
        functionsStr += `\t${className}__${funcName} (fromThis, ...args) {` 
          + `const newThis = new ${className}(); `
          + `Object.assign(newThis, fromThis); `
          + `return Promise.resolve(Reflect.apply(newThis.${funcName}, newThis, args))`
          + `.then((result) => { return {newThis, result }; }); `
          + `},\n`;
      }
    }

    const initMessages = '\nsimpleWebExt.initMessages(messageFunctions);';
    return {
      init: createSimpleWebExt,
      body: `const messageFunctions={\n${functionsStr}};`
        + initMessages
    };
  }
}

