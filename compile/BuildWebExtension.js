
import * as fsPromises from 'node:fs/promises';
import * as esbuild from 'esbuild';
import * as path from 'node:path';
import {SplitWebExtension} from './SplitWebExtension.js';
import resolve from 'resolve';
import { fileURLToPath } from 'url';
import syncDirectory from 'sync-directory';
import assert from 'assert';
import AdmZip from 'adm-zip';
import fs from 'fs';


export class BuildWebExtension {
  static manifestFile = 'manifest.json';

  static resolvePromise(opts, path) {
    return new Promise((r) => {
      return resolve(path, opts, function (err, res) {
        if (err)  {
          return r();
        }
        return r(res);
      });
    });
  }

  static listDir(directory) {
    fs.readdir(directory, (err, files) => {
      if(err || !files) {
        console.log('direrr',directory,err);
      } else {
        console.log('dir', directory, files.join(', '));
      }
    });
  }

  static buildJs(srcDir, destDir, file, includeDirs) {
    function resolvePathPromise(p, includeDir, args) {
      return p.then((path) => {
        if(path) {
          return path;
        }
        return BuildWebExtension.resolvePromise({
          basedir: includeDir
        }, args.path);
      });
    }

    const exampleOnResolvePlugin = {
      name: 'example',
      setup(build) {

        build.onResolve({ filter: /./}, async (args) => {
          const importerDir = path.dirname(args.importer);
          const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

          let p = BuildWebExtension.resolvePromise({
            basedir: dir,
            moduleDirectory: 'lib',
          }, args.path)
          .then((p) => {
            if(p) {
              return p;
            }
            if(args.path === 'simple-webextension') {
              return path.join( dir, 'lib/SimpleWebExtensionUtil.js');
            }
          });

          const includeDirsAll = [path.join(dir, 'lib'), importerDir, srcDir, ...includeDirs];
          BuildWebExtension.listDir(path.join(process.cwd(), "."));
          BuildWebExtension.listDir(path.join(process.cwd(), ".."));
          BuildWebExtension.listDir(path.join(process.cwd(), "../.."));
          BuildWebExtension.listDir(path.join(process.cwd(), "../../.."));
          BuildWebExtension.listDir(path.join(process.cwd(), "../../../node_modules"));
          BuildWebExtension.listDir(path.join(process.cwd(), "../../../node_modules/simple-webextension"));
          BuildWebExtension.listDir(dir);
          BuildWebExtension.listDir(path.join(dir, 'lib'));

          for (const includeDir of includeDirsAll) {
            p = resolvePathPromise(p, includeDir, args);
          }

          p = p.then((path) => {
            if(path) {
              return path;
            }
            console.error(`Could not find: ${args.path} in dirs: ${dir}, ${includeDirsAll.join(',')}`);
          }).then((path) => {
            if(path) {
              return { path };
            }
          });
          return p;
        })
      },
    };

    return esbuild.build({
      entryPoints: [path.join(srcDir, file)],
      outfile: path.join(destDir, file),
      plugins: [exampleOnResolvePlugin],
      bundle: true,
    });
  }

  static buildAllJs(srcDir, destDir, scriptTypes, includeDirs) {
    const files = [];
    for(const scriptType of scriptTypes) {
      files.push(scriptType + '.js');
    }
    let p = Promise.resolve();
    for (const f of files) {
      p = p.then(() => this.buildJs(srcDir, destDir, f, includeDirs));
    }
    return p;
  }

  static getPackageJson(dir) {
    const packageJson = path.join(dir, 'package.json');
    return fsPromises.stat(packageJson).then(() => {
      return fsPromises.readFile(packageJson).then((str) => {
        return JSON.parse(str);
      });
    }).catch(() => {
      return null;
    });
  }

  static syncDir(srcDir, destDir, options) {
    return fsPromises.stat(srcDir).then(() => {
      return syncDirectory.async(srcDir, destDir, options);
    }).catch(() => { });
  }

  static compileFromDir(options) {
    const dir = options.srcDir;
    const allUserAgentPath = path.join(dir, "extension");

    return this.getPackageJson(dir).then((packageJson) => {
      if (!packageJson) {
        packageJson = {};
      }
      const name = packageJson.name
        || path.basename(path.resolve(dir));

      let mainFiles = [];
      if (packageJson.webextension) {
        if (packageJson.webextension.scripts) {
          mainFiles = packageJson.webextension.scripts;
        }
      }
      mainFiles.push(path.join(dir, packageJson.main || 'index.js'));
      options.name = name;

      return mainFiles;
    }).then((mainFiles) => {
      return this.compileFromFiles(mainFiles, options);
    }).then((compileInfos) => {
      const urlMatch = options.urlMatch || 'https://YOUR_WEBSITE.COM/*';
      return this.copyBlankManifest({name: options.name, urlMatch}, allUserAgentPath)
        .then(() => { return compileInfos; });
    }).then((compileInfos) => {
      let p = Promise.resolve();
      const copyFiles = (p, userAgent, compileInfo) => {
        const userAgentPath = path.join(dir, userAgent);
        return p.then(() => this.copyFromSingleManifest(
            userAgent,
            path.join(compileInfo.extensionDir, this.manifestFile),
            path.join(allUserAgentPath, this.manifestFile)
          )
        ).then(() => this.syncDir(userAgentPath, compileInfo.extensionDir)
        ).then(() => this.syncDir(
          allUserAgentPath, 
          compileInfo.extensionDir,
          {
            exclude: this.manifestFile
          })
        );
      };

      for (const userAgent in compileInfos) {
        const compileInfo = compileInfos[userAgent];
        p = copyFiles(p, userAgent, compileInfo);
      }
      return p.then(() => compileInfos);
    }).then((compileInfos) => {
      let p = Promise.resolve();
      const zipFiles = [];
      if (options.zip) {
        let buildDir;
        for (const userAgent in compileInfos) {
          const compileInfo = compileInfos[userAgent];
          const zipFile = path.join(compileInfo.destDir, userAgent + '.zip');
          buildDir = compileInfo.buildDir;
          compileInfo.zipFile = zipFile;
          zipFiles.push({extensionDir: compileInfo.extensionDir, userAgent});
          p = p.then(() => {
            return this.zip(zipFile, compileInfo.extensionDir);
          });
        }

        p = p.then(() => {
          const admZip = new AdmZip();
          for(const z of zipFiles) {
            admZip.addLocalFolder(z.extensionDir, z.userAgent);
          }
          admZip.writeZip(path.join(buildDir, 'all.zip'));
        });
      }
      return p.then(() => compileInfos);
    });
  }

  static concatFiles(files) {
    let p = Promise.resolve();
    const datas = [];
    for (const file of files) {
      p = p.then(() => fsPromises.readFile(file))
        .then(data => datas.push(data.toString()));
    }
    return p.then(() => {
      return datas.join('');
    });
  }

  static compileFromFiles(files, options) {
    assert(files.length > 0);

    const name = options.name || path.basename(files[0], '.js');

    const splitWebExtension = new SplitWebExtension();
    splitWebExtension.srcDir = options.srcDir;
    const destDir = options.buildDir || 'build';
    let codeStr = '';

    const compileInfos = {};
    return this.concatFiles(files)
    .then(code => {
      codeStr = code;
      return splitWebExtension.parse(code);
    }).then(async () => {
      const userAgents = options.userAgents || ['firefox', 'chrome'];
      for (const userAgent of userAgents) {
        await this.compileForUserAgent(
          splitWebExtension, name,
          userAgent, destDir, codeStr
        ).then((compileInfo) => {
          compileInfo.buildDir = destDir;
          compileInfo.errors = splitWebExtension.errors;
          splitWebExtension.clearErrors();
          compileInfos[userAgent] = compileInfo;
        });
      }
    }).then(() => {
      return compileInfos;
    });
  }

  static formatStringLiteral (str, obj) {
    return str.replace(/\${(.*?)}/g, (x,g)=> obj[g]);
  }

  static copyFromSingleManifest(userAgent, destManifest, srcManifest) {
    return fsPromises.stat(srcManifest).then(() => {
      return fsPromises.readFile(srcManifest).then(str => {
        return JSON.parse(str);
      }).then((manifestObj) => {
        if (manifestObj.userAgents) {
          const userAgentOnlyProps = manifestObj.userAgents[userAgent];
          delete manifestObj.userAgents;
          Object.assign(manifestObj, userAgentOnlyProps);
        }
        return fsPromises.writeFile(
          destManifest,
          JSON.stringify(manifestObj, null, 4)
        );
      });
    });
  }

  static copyBlankManifest(options, destDir) {
    const manifest = this.manifestFile;

    const dir = path.dirname(fileURLToPath(import.meta.url));
    const srcManifest = path.join(dir, '../extension', manifest);
    const destManifest = path.join(destDir, manifest);
    return fsPromises.stat(destManifest).catch(() => {
      return fsPromises.mkdir(destDir, {recursive: true})
        .finally(() => {
        return fsPromises.readFile(srcManifest).then((code) => {
          return this.formatStringLiteral(
            code.toString('utf-8'),
            options
          );
        }).then(
          (code) => {
            return fsPromises.writeFile(destManifest, code)
          }
        );
      }).catch(() => {});
    });
  }

  static compileForUserAgent(splitWebExtension, name, userAgent, destDir, codeStr) {
    const browserDestDir = path.join(destDir, userAgent);
    return Promise.resolve().then(
      () => fsPromises.mkdir(browserDestDir, {recursive: true})
        .catch(() => {})
    ).then(() => {
      splitWebExtension.setUserAgent(userAgent);
      return this.compileSourceToDir(
        splitWebExtension, 
        name,
        browserDestDir,
        codeStr
      );
    });
  }

  static compileSourceToDir(splitWebExtension, name, destDir, code) {
    name = name.replace(/[^a-zA-Z0-9\-.]/g,'-');
    const scriptsDir = path.join(destDir, 'scripts');
    const extensionDir = path.join(destDir, 'extension');
    return Promise.resolve().then(
      () => fsPromises.mkdir(scriptsDir, {recursive: true})
    ).then(
      () => fsPromises.mkdir(extensionDir, {recursive: true})
    ).then(() => {
      splitWebExtension.clearFiles();
      splitWebExtension.splitToFiles();
      return splitWebExtension.generate(
        scriptsDir, name, code
      );
    }).then(() => {
      const scriptTypes = splitWebExtension.getScriptTypes();
      return this.buildAllJs(
        scriptsDir,
        extensionDir,
        scriptTypes,
        [splitWebExtension.srcDir]
      );
    }).then(() => {
      return {extensionDir, scriptsDir, destDir};
    });
  }

  static printCompileInfosErrors(compileInfos) {
    for (const c in compileInfos) {
      const errors = compileInfos[c].errors;
      if (errors.length > 0) {
        console.error(errors.join('\n'));
      }
    }
  }

  static zip(destZip, srcDir) {
    const admZip = new AdmZip();
    admZip.addLocalFolder(srcDir);
    admZip.writeZip(destZip);
  }
}


