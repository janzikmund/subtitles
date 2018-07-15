#!/usr/bin/env node

// load .env variables. Needs passing the path, otherwise node would search for .env
// in the movie folder where script command is called from
require('dotenv').config({
	path: __dirname + '/.env'
});

var program = require('commander'),
fs = require('fs'),
_ = require('lodash'),
OS = require('opensubtitles-api'),
OpenSubtitles = new OS('White Box App'),
TheMovieDatabase = require('themoviedb'),
Youtubedl = require('youtube-dl'),
pluralize = require('pluralize'),
path = require('path');

// main launch script
run = function() {
	// setup application
	program
	.version('0.1.0')
	.usage('[options] <file ...>')
	.description('Downloads subtitles and trailer for movie.')
	.option('-t, --trailer', 'Download just trailer')
	.option('-s, --subtitles', 'Download just subtitles')
	.parse(process.argv);

	// if any files provided, take them as files to be searched for,
	if(program.args.length > 0) {
		parseSpecifiedFiles(program.args, program.trailer, program.subtitles);
	} else {
		parseActualFolder(program.trailer, program.subtitles);
	}
},

// parse files in actual folder to find biggest one
parseActualFolder = function(trailer, subtitles) {
	var files = [];
	fs.readdir('.', (err, folder) => {
		folder.forEach(file => {
			var stats = fs.statSync(file);
			files.push({ 'name': file, 'size': stats["size"], 'stats' : stats });
		});

		// take biggest file
		files = _.orderBy(files, 'size', 'desc');

		// download subtitles if set or no param specified
		if(subtitles || (!subtitles && !trailer)) {
			searchSubtitles(files[0]);
		}

		// download trailer if set or no param specified
		if(trailer || (!subtitles && !trailer)) {
	  		downloadTrailer(files[0]);
	 	}
	});
},

// parse files specified as parameters
parseSpecifiedFiles = function(filenames, trailer, subtitles) {
	filenames.forEach(file => {
		var stats = fs.statSync(file),
		file = { 'name': file, 'size': stats["size"], 'stats' : stats };

		// subtitles if not excluded
		if(subtitles || (!subtitles && !trailer)) {
			searchSubtitles(file);
		}

		// trailer if turned on
		if(trailer || (!subtitles && !trailer)) {
			downloadTrailer(file);
		}
	});

},

// guess movie name from its filename
guessMovieName = function(filename) {
	filename = filename.split('/').pop() 	// just take last file if any folders present
		.split(/\d\d\d/).shift()				// if there is number of three decimals, take everything before
		.replace(/[^\w\d]/gi, ' ');
		return filename;
},

bytesToSize = function(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return 'n/a'
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10)
  if (i === 0) return `${bytes} ${sizes[i]})`
  return `${(bytes / (1024 ** i)).toFixed(1)} ${sizes[i]}`
},

// download subtitles from API
searchSubtitles = function (file) {
	console.log('Searching subtitles for ', file.name);
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
			var i = '1',
			filename_base = file.name.substring(0, file.name.lastIndexOf(".") ),
			suffix = '',
			movie_name = guessMovieName(filename_base);

			// if english subtitles, download them
			if (subtitles.en) {
				console.log('[ ' + movie_name + ' ]  -- Subtitle found --');
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
								console.log('[ ' + movie_name + ' ]  Subtitles downloaded: ' + filename);
							});
						});
					});

					// raise index and suffix
					i++;
					suffix = '.v-' + i;
				});

			} else {
				throw 'No subtitle found';
			}
		})
		// catch if no subtitles found or other error and display it
		.catch(err => {
			var filename_base = file.name.substring(0, file.name.lastIndexOf(".") ),
			movie_name = guessMovieName(filename_base);
			console.log('[ ' + movie_name + ' ]  Error: ' + err);
		});
	});
},

// store file from youtube
storeYoutubeFile = function(url, movieName, file) {
	var targetFile = path.dirname(process.cwd() + '/' + file.name) + '/_trailer.mp4',
	video = Youtubedl(url,
	  // Optional arguments passed to youtube-dl.
	  [/*'--format=18'*/],
	  // Additional options can be given for calling `child_process.execFile()`.
	  // store it to movie folder
	  { cwd: __dirname }
	);

	// called when the download starts.
	video.on('info', function(info) {
	  console.log(`[ ${movieName} ]  Downloading trailer: ${info._filename}`);
	  console.log(`[ ${movieName} ]  Trailer size: ${bytesToSize(info.size)}`);
	});

	// download
	video.pipe(fs.createWriteStream(targetFile));

	// download finished
	video.on('end', function() {
		console.log(`[ ${movieName} ]  Trailer downloaded.`);
	});
},

// filter multiple videos returned to find best matching trailer
chooseBestTrailer = function(videos) {

	// first pass - keep only items containing 'trailer', if multiple items have it keep only those for next filters
	var filtered = _.filter(videos, o => _.includes(_.lowerCase(o), 'trailer') );
	if(filtered.length === 1) {
		return filtered;
	} else if (filtered.length > 1) {
		videos = filtered;
	}

	// return what we have
	return videos[1];
},

// download trailer for movie
downloadTrailer = function(file) {
	var movieName = guessMovieName(file.name),
	client = new TheMovieDatabase(process.env.TMD_APIKEY);

	console.log(`[ ${movieName} ]  Searching for trailer`);

	// search for movies
	client.searchMovies({
		query: movieName,
		sortBy: 'popularity.desc',
		includeAdult: false
	}, function(err, movies) {
		if(movies.length > 0) {
			console.log(`[ ${movieName} ]  Movie found in database: ${movies[0].title}`);
			console.log(`[ ${movieName} ]  Year ${movies[0].year}, Rating ${movies[0].voteAverage}`);

			// grab trailers
			client.getVideosOfMovie(movies[0].id, function(err, res) {
				if(res.videos.length > 0) {
			    	console.log(`[ ${movieName} ]  ${pluralize('trailer', res.videos.length, true)} found.`);

					// determine video and download it
					var video = (res.videos.length === 1 ? res.videos[0] : chooseBestTrailer(res.videos));
			    	storeYoutubeFile(video.url, movieName, file);
				} else {
					console.log(`[ ${movieName} ]  No trailers found for the movie.`);
				}
			});
		} else {
			console.log(`[ ${movieName} ]  Movie not found in database.`);
		}
	});
};

// run command
run();
