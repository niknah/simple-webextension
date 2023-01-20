
import {program} from 'commander';
import {BuildWebExtension} from './BuildWebExtension.js';

program.name('webext-cli')
  .description('Compile to a web extension')
  .option('--src-dir <dir>', 'Optional: Source directory of the project. Default: current directory.')
  .option('--build-dir <dir>', 'Optional: Destination to put things into. Default: "build"')
  .option('--url-match <url>', 'URLs to run the script on.  Example: https://websitetochange.com/*')
  .option('--user-agents <useragent...>', 'User agent. ie. firefox, chrome')
  .option('--files <files...>', 'Optional: Single javascript file to compile')
  .option('--zip', 'Zip up extension')
  .action((options) => {
    if (options.file) {
      if (options.srcDir) {
        console.error('Cannot have both source file and dir');
        program.help({ error: true });
      } else {
        return BuildWebExtension.compileFromFiles(options.files, options);
      }
    } else {
      const srcDir = options.srcDir || '.';
      options.srcDir = srcDir;
      return BuildWebExtension.compileFromDir(options).then((compileInfos) => {
        BuildWebExtension.printCompileInfosErrors(compileInfos);
      }).catch(e => {
        console.error(e);
        program.help({ error: true });
      });
    }
  });

program.parse();

