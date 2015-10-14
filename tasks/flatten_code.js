/*
 * grunt-flatten-code
 * https://github.com/Indomian/grunt-flatten-code
 *
 * Copyright (c) 2015 Egor Bolgov
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
  var fs = require('fs');
  var path = require('path');
  var options = {
    process: null,
    rootPath: '.',
    prefix: './lib/',
    skip: []
  };

  function processContent(moduleId, dest, src) {
    var srcNormalized = path.normalize(src);
    var destNormalized = path.normalize(dest);
    var srcFull = path.resolve(srcNormalized);
    var destNull = path.resolve(destNormalized);
    var srcDirname = path.dirname(srcFull);
    var destDirname = path.dirname(destNull);

    if (/^(\.\/|\..\/)/i.test(moduleId)) {
      console.log('Relative module path: ' + moduleId);
      return "require('" + moduleId + "')";
    } else {
      var rootPath = path.normalize(options.rootPath + path.sep + options.prefix + path.sep + moduleId);
      var relative = path.relative(destDirname, rootPath);
      console.log('Node_modules path: ' + moduleId + ' -> ' + relative);
      try {
        var modulePath = require.resolve(moduleId);
        var moduleFile = path.basename(modulePath);
        if (!fs.existsSync(rootPath)) {
          processInnerFile(modulePath, rootPath + path.sep + moduleFile);
        }
      } catch (e) {
        if (options.skip.some(function(element) {
            if (element instanceof RegExp) {
              return element.test(moduleId);
            } else {
              return moduleId.indexOf(element) === 0
            }
          })) {
          return "require('" + moduleId + "')";
        }
      }

      return "require('" + relative + "')";
    }
  }

  function processInnerFile(src, dest) {
    grunt.log.writeln('\tProcessing inner file ' + src);
    var content = fs.readFileSync(src, {encoding: 'UTF-8'});
    var match;
    var regexp = /require\(('|")([^'"]+)('|")\)/igm;
    var srcDir = path.dirname(src);
    var destPath = path.dirname(dest);
    var modulePath;
    var moduleFile;
    while (match = regexp.exec(content)) {
      if (/^(\.\/|\..\/)/i.test(match[2])) {
        var filePath = path.normalize(destPath + path.sep + match[2]);
        var fileSrcPath = path.normalize(srcDir + path.sep + match[2]);
        if (fs.existsSync(fileSrcPath) && !fs.existsSync(filePath)) {
          processInnerFile(fileSrcPath, filePath);
        }
      } else {
        var rootPath = path.normalize(options.rootPath + path.sep + options.prefix + path.sep + match[2]);
        var relative = path.relative(destPath, rootPath);
        console.log('\tNode_modules path: ' + match[2] + ' -> ' + relative);
        try {
          modulePath = require.resolve(match[2]);
          moduleFile = path.basename(modulePath);
          if (!fs.existsSync(rootPath)) {
            processInnerFile(modulePath, rootPath + path.sep + moduleFile);
          }
        } catch (e) {
          var relativeSource = srcDir + path.sep + 'node_modules' + path.sep + match[2];
          console.log('\tNot found: ' + match[2] + ', checking ' + relativeSource);
          if (fs.existsSync(relativeSource)) {
            modulePath = require.resolve(relativeSource);
            moduleFile = path.basename(modulePath);
            if (!fs.existsSync(rootPath)) {
              processInnerFile(modulePath, rootPath + path.sep + moduleFile);
            }
          }
        }

        content = content.replace(match[0], "require('" + relative + "')");
      }
    }
    grunt.file.write(dest, content);
    grunt.log.writeln('\tFile "' + dest + '" created.');
  }

  function processFile(src, dest) {
    grunt.log.writeln('Processing "' + dest);
    var content = fs.readFileSync(src, {encoding: 'UTF-8'});

    content = content.replace(/require\(('|")([^'"]+)('|")\)/igm, function(match, quoteLeft, moduleId, quoteRight) {
      return processContent(moduleId, dest, src);
    });

    if (options.process !== null) {
      content = options.process(content, src);
    }

    grunt.file.write(dest, content);
    // Print a success message.
    grunt.log.writeln('File "' + dest + '" created.\n\n');
  }

  grunt.registerMultiTask('flatten', 'Plugin extracts working files and dependencies for node_modules in flat structure. Usefull for Firefox Addons require.', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    options = this.options({
      process: null,
      rootPath: '.',
      prefix: './lib/',
      skip: []
    });
    options.rootPath = path.resolve(options.rootPath);

    // Iterate over all specified file groups.
    this.files.forEach(function(f) {
      // Concat specified files.
      var src = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      }).forEach(function(src) {
        processFile(src, f.dest);
      });
    });
  });

};
