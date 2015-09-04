
/*
 * GET users listing.
 */

var crypto = require('crypto');
var mongo = require('mongodb');
var validator = require('validator');
var moment = require('moment');
var mdb = require('../mdb');
var remember = require('../remember');

exports.list = function(req, res){
    if (('user' in req) && (req.user.superuser)) {
	mdb.User.find(function(err,document) {
            if (document) {
		res.render('users', { users: document, title: 'users' });
	    } else {
		res.status(500).render('fail', { title: "Users not found", error: "I could not find any users." });
	    }
	});
    } else {
	res.status(403).render('fail', { title: "Users not visible", error: "You are not a superuser." });
    }
};

exports.getCurrent = function(req, res){
    if (!req.user) {
	res.json(0);
	return;
    }

    req.user.gravatar = crypto.createHash('md5').update(req.user.email).digest("hex");
    res.json(req.user);
};

exports.currentProfile = function(req, res){
    var editable = true;
    res.render('user', { userId: '', user: req.user, editable: editable, title: req.user.name } );
};

exports.profile = function(req, res){
    var id = req.params.id;
    var editable = ('user' in req) && (req.user.superuser || (req.user._id === id));
    res.render('user', { userId: req.params.id, user: req.user, editable: editable, title: 'Profile' } );
};

////////////////////////////////////////////////////////////////
// delete an account, unless it is the last linked account
exports.deleteLinkedAccount = function(req, res, account){
    var id = req.params.id;
    
    if (!req.user) {
	res.send(401);
    }
    
    // BADBAD: should include more nuanced security here
    if (req.user._id.toString() != id) {
        res.status(500).send('No permission to access other users.');
	return;
    }

    accountHash = {};

    present = { $exists: true };
    otherAccounts = { googleOpenId: present, 
		      twitterOAuthId: present,
		      courseraOAuthId: present,
		      githubId: present };
    
    if (account == 'google') {
	accountHash['googleOpenId'] = "";
	delete otherAccounts['googleOpenId'];
    }
    
    if (account == 'twitter') {
	accountHash['twitterOAuthId'] = "";
	delete otherAccounts['twitterOAuthId'];
    }

    if (account == 'coursera') {
	accountHash['courseraOAuthId'] = "";
	delete otherAccounts['courseraOAuthId'];
    }

    if (account == 'github') {
	accountHash['githubId'] = "";
	delete otherAccounts['githubId'];
    }

    // Need an array instead of a hash for mongodb $or
    otherAccounts = Object.keys(otherAccounts).map( function(x) {
	var pair = {};
	pair[x] = otherAccounts[x];
	return pair;
    });
    
    // Only look for a user who has OTHER accounts available
    mdb.User.update({ _id: new mongo.ObjectID(id),
			  $or: otherAccounts
			},
			{ $unset: accountHash },
			{},
			function(err,result,status) {
			    if (err)
				res.status(500).send("Unknown error.");
			    else {
				if (result.n <= 0) {
				    res.status(404).send("No other account available; you cannot delete the only linked account.");
				} else {
				    res.status(200).send("Successfully removed " + account);
				}
			    }
			});
    
    return;
}

exports.get = function(req, res){
    var id = req.params.id;

    if (!req.user) {
	res.send(401);
    }

    // BADBAD: should include more nuanced security here
    if (req.user._id.toString() != id) {
        res.status(500).send('No permission to access other users.');
	return;	
    }

    // Add one view to the count of profileViews
    mdb.User.update({_id: new mongo.ObjectID(id)},
			{ $inc: { profileViews: 1 } });
    
    mdb.User.findOne({_id: new mongo.ObjectID(id)}, function(err,document) {
        if (document) {

	    if (document.email)
	    	document.gravatar = crypto.createHash('md5').update(validator.normalizeEmail(document.email)).digest("hex");

	    if (document.birthday) {
		document.formattedBirthday = moment(new Date(document.birthday)).format('MMMM D, YYYY');
	    }	    
	    
	    if (req.user._id.toString() == id)
		document.pronouned = "me";
	    else
		document.pronouned = document.name;		
	    
	    res.format({
		html: function(){
		    remember(req);
		    
		    res.render('user/profile', { userId: req.params.id,
						 user: req.user,
						 script: "user/profile",
						 person: document,
						 editable: true,
						 title: 'Profile' } );
		},

		json: function(){
		    res.json(document);
		}
	    });
        }
        else {
	    res.status(404).json({});
        }
    });
};

exports.edit = function(req, res){
    var id = req.params.id;

    if (!req.user) {
	res.send(401);
    }

    // BADBAD: should include more nuanced security here
    if (req.user._id.toString() != id) {
        res.status(500).send('No permission to access other users.');
	return;	
    }

    mdb.User.findOne({_id: new mongo.ObjectID(id)}, function(err,document) {
        if (document) {
	    
	    if (document.email)
	    	document.gravatar = crypto.createHash('md5').update(validator.normalizeEmail(document.email)).digest("hex");

	    if (req.user._id.toString() == id)
		document.pronouned = "me";
	    else
		document.pronouned = document.name;			    

	    if (document.birthday) {
		document.formattedBirthday = moment(new Date(document.birthday)).format('MMMM D, YYYY');
	    }
	    
	    res.format({
		html: function(){
		    remember(req);
		    
		    res.render('user/edit', { userId: req.params.id,
					      user: req.user,
					      script: "user/profile",
					      person: document,
					      editable: true,
					      title: 'Profile' } );
		},
	    });
        }
        else {
	    res.status(404).json({});
        }
    });
};

exports.update = function(req, res){
    var id = req.params.id;

    if (!req.user) {
	res.send(401);
    }

    // BADBAD: should include more nuanced security here
    if (req.user._id.toString() != id) {
        res.status(500).send('No permission to access other users.');
	return;	
    }

    mdb.User.findOne({_id: new mongo.ObjectID(id)}, function(err,document) {
        if (document) {

	    if (document.email)
	    	document.gravatar = crypto.createHash('md5').update(validator.normalizeEmail(document.email)).digest("hex");	    

	    if (req.user._id.toString() == id)
		document.pronouned = "me";
	    else
		document.pronouned = document.name;			    
	    
	    var hash = {};

	    if (req.body.displayName)
		document.displayName = hash.displayName = validator.toString(req.body.displayName);	    
	    else
		document.displayName = hash.displayName = '';		

	    if (req.body.visibility)
		if (validator.isIn(req.body.visibility, ["none", "users", "everyone"]))
		    document.visibility = hash.visibility = req.body.visibility;
	    
	    if ((req.body.email) && (validator.isEmail(req.body.email)))
		document.email = hash.email = validator.normalizeEmail(req.body.email);
	    else
		document.email = hash.email = '';		
	    
	    if ((req.body.homepage) && (validator.isURL(req.body.homepage)))
		document.website = hash.website = req.body.homepage;
	    else
		document.website = hash.website = '';	

	    if (req.body.birthday)
		document.birthday = hash.birthday = validator.toDate(req.body.birthday);
	    else
		document.birthday = '';

	    if (document.birthday) {
		document.formattedBirthday = moment(new Date(document.birthday)).format('MMMM D, YYYY');
	    }	    
	    
	    if (req.body.biography)
		document.biography = hash.biography = validator.toString(req.body.biography);
	    else
		document.biography = hash.biography = '';
	    
	    if (req.body.location)
		document.location = hash.location = validator.toString(req.body.location);
	    
	    mdb.User.update( {_id: new mongo.ObjectID(id)}, {$set: hash},
			     function(err, d) {
				 
				 if (err)
				     res.send(500);
				 else {	
				     res.render('user/profile', { userId: req.params.id,
								  user: req.user,
								  updated: true,
								  script: "user/profile",
								  person: document,
								  editable: true,
								  title: 'Profile' } );
				 }
			     });
        }
        else {
	    res.status(404).json({});
        }
    });
};

