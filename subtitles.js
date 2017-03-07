#!/usr/bin/env node

// modules
require('dotenv').load();

const fs = require('fs'),
_ = require('lodash'),
OS = require('opensubtitles-api'),
OpenSubtitles = new OS(process.env.USER_AGENT),

parseFiles = function() {
	var files = [];
	fs.readdir('.', (err, folder) => {
	  folder.forEach(file => {
	  	var stats = fs.statSync(file);
	  	files.push({ 'name': file, 'size': stats["size"], 'stats' : stats });
	  });

	  // take biggest file
	  files = _.orderBy(files, 'size', 'desc');
	  searchSubtitles(files[0]);
	});
},

searchSubtitles = function (file) {
	console.log('searching subtitles for ', file.name);
	OpenSubtitles.api.LogIn(process.env.USER, process.env.PASS, process.env.LANG, process.env.USER_AGENT).then(res => {
		OpenSubtitles.search({
		    sublanguageid: 'eng',    // Can be an array.join, 'all', or be omitted.
		    filesize: file.size,     // Total size, in bytes.
		    path: './' + file.name,  // Complete path to the video file, it allows to automatically calculate 'hash'.
		    filename: file.name,     // The video file name. Better if extension is included.
		    extensions: ['srt'],     // Accepted extensions, defaults to 'srt'.
		    limit: '5',              // Limit the number of results
		    gzip: true               // Returns url to gzipped subtitles, defaults to false
		}).then(subtitles => {
			// if english subtitles, download them
			if (subtitles.en) {
			    console.log('-- Subtitle found --');
			    var i = '1';
			    var filename_base = file.name.substring(0, file.name.lastIndexOf(".") );
			    var suffix = '';
			    subtitles.en.forEach( subtitle => {
			    	// resolve filename
			    	var filename = './' + filename_base + suffix + '.srt';

				    require('request')({
				        url: subtitle.url,
				        encoding: null
				    }, (error, response, data) => {
				        if (error) throw error;
				        // set default encoding if not in subtitle
				        if(typeof subtitle.encoding === undefined || (subtitle.encoding !=='ascii' && subtitle.encoding !=='utf8' && subtitle.encoding !=='ascii'  && subtitle.encoding !=='ucs2'  && subtitle.encoding !=='latin1') ) subtitle.encoding = 'utf8';
				        require('zlib').unzip(data, (error, buffer) => {
				            if (error) throw error;
				            const subtitle_content = buffer.toString(subtitle.encoding);
				            fs.writeFile(filename, subtitle_content, function(err) {
				            	if(err) {
				            		throw error;
				            	}
				            	console.log('Subtitles downloaded: ' + filename);
				            });
				        });
				    });

				    // raise index and suffix
				    i++;
				    suffix = '.v-' + i;
			    });


			} else {
			    throw 'no subtitle found';
			}
		});
	});
};


parseFiles();