
/*
 * GET users listing.
 */

var crypto = require('crypto');
var mongo = require('mongodb');
var mdb = require('../mdb');
var winston = require("winston");
var mongoose = require('mongoose');

// The GitHub webhook secret must be set in app.js
exports.secret = '';

exports.github = function(req, res){
    var hash = req.header("X-Hub-Signature");
    var hmac = crypto.createHmac("sha1", exports.secret);
    var content = '';

    hmac.update(req.rawBody);
    var crypted = 'sha1=' + hmac.digest("hex");

    if(crypted === hash) {
        // Valid signature
	if (req.header("X-GitHub-Event") == "ping") {
	    res.send(200);
	    return;
	}

	var repository = req.body.repository;

	if (repository && ('full_name' in repository)) {
	    console.log( "repository = " + JSON.stringify(repository) );
	    var sender = req.body.sender;
	    console.log( "sender = " + JSON.stringify(sender) );
	    
	    mdb.GitRepo.findOne({gitIdentifier: repository.full_name}).exec( function (err, repo) {
		if (repo) {
		    // Courses linked to repo need to be updated
		    mdb.GitRepo.update( repo, {$set: { needsUpdate : true }}, {},
					function( err, document ) {
					    winston.info( 'Requesting update for repo ' + repository.full_name );
					    res.send(200);
					});
		} else {
		    // This is a new repo; we should create it (and wait for the external processor to create the courses therein)
		    repo = mdb.GitRepo({
			gitIdentifier: repository.full_name,
			file: mongoose.Types.ObjectId(),
			needsUpdate: true,
		    });
		    
		    repo.save(function () {
			winston.info( 'Requesting creation of repo ' + repository.full_name );
			res.send(200);
		    });
		}

		mdb.User.findOne({githubId: sender.id}).exec( function(err, githubUser) {
		    var push = mdb.GitPushes({
			gitIdentifier: repository.full_name,
			sender: sender,
			repository: repository,
			senderAccessToken: githubUser.githubAccessToken,
			headCommit: req.body.head_commit,
			finishedProcessing: false
		    });

		    push.save();
		});
	    });
	}
    } else {
        // Invalid signature
        res.send(403, "Invalid X-Hub-Signature");
    }
};
