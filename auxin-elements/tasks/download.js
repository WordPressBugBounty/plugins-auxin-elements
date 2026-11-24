'use strict';

/**
 * Local replacement for the abandoned grunt-http-download package.
 * Compatible with Grunt 1.x / Node 18+.
 */
module.exports = function (grunt) {
    var fs = require('fs');
    var http = require('http');
    var https = require('https');
    var path = require('path');
    var { URL } = require('url');

    function getEngine(fileUrl) {
        return /^https:/i.test(fileUrl) ? https : http;
    }

    function isDirectory(dest) {
        return /[\\/]$/.test(dest);
    }

    grunt.registerMultiTask('download', 'Download files via HTTP(S).', function () {
        var done = this.async();
        var files = this.files;
        var remaining = files.length;

        if (!remaining) {
            done();
            return;
        }

        files.forEach(function (file) {
            var src = file.src[0] || file.orig.src[0];
            var dest = file.dest;

            if (!src) {
                grunt.log.warn('No download source specified.');
                if (--remaining === 0) {
                    done();
                }
                return;
            }

            var target = dest;
            if (isDirectory(dest)) {
                target = path.join(dest, path.basename(new URL(src).pathname));
            }

            grunt.file.mkdir(path.dirname(target));

            getEngine(src).get(src, function (response) {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    src = response.headers.location;
                    getEngine(src).get(src, writeResponse).on('error', fail);
                    return;
                }

                writeResponse(response);
            }).on('error', fail);

            function writeResponse(response) {
                if (response.statusCode !== 200) {
                    fail(new Error('Download failed with status ' + response.statusCode + ' for ' + src));
                    return;
                }

                var stream = fs.createWriteStream(target);
                response.pipe(stream);
                stream.on('finish', function () {
                    grunt.log.ok('Downloaded ' + src + ' → ' + target);
                    if (--remaining === 0) {
                        done();
                    }
                });
                stream.on('error', fail);
            }

            function fail(err) {
                grunt.fail.warn(err);
                done(false);
            }
        });
    });
};
