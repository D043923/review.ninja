'use strict';
// services
var url = require('../services/url');
var github = require('../services/github');
var webhook = require('../services/webhook');

// models
var User = require('mongoose').model('User');

module.exports = {
    addRepo: function(req, done) {
        github.call({
            obj: 'repos',
            fun: 'one',
            arg: { id: req.args.repo_uuid },
            token: req.user.token
        }, function(err, repo) {

            if(!repo.permissions.push) {
                return done({
                    code: 403,
                    text: 'Forbidden'
                });
            }

            User.findOne({ uuid: req.user.id }, function(err, user) {
                if(user) {
                    var found = false;
                    user.repos.forEach(function(repo) {
                        if(repo === req.args.repo_uuid) {
                            found = true;
                        }
                    });

                    if(!found) {
                        user.repos.push(req.args.repo_uuid);
                        user.save();
                    }

                    // create hook, if it does not exist
                    if(repo.permissions.admin) {
                        webhook.get(req.args.user, req.args.repo, req.user.token,
                            function(err, hook) {
                                if(!err && !hook) {
                                    github.call({
                                        obj: 'repos',
                                        fun: 'createHook',
                                        arg: {
                                            user: repo.owner.login,
                                            repo: repo.name,
                                            name: 'web',
                                            config: { url: url.webhook(user._id), content_type: 'json' },
                                            events: config.server.github.webhook_events,
                                            active: true
                                        },
                                        token: req.user.token
                                    });
                                }
                            }
                        );
                    }
                }

                done(err, {repos: user ? user.repos : null});
            });
        });

    },

    rmvRepo: function(req, done) {

        // remove from user array
        User.findOne({ uuid: req.user.id }, function(err, user) {
            if(user) {
                var repos = [];
                user.repos.forEach(function(repo) {
                    if(repo !== req.args.repo_uuid) {
                        repos.push(repo);
                    }
                });

                user.repos = repos;
                user.save();
            }

            done(err, {repos: user ? user.repos : null});
        });
    },

    dismiss: function(req, done) {
        User.findOne({ uuid: req.user.id }, function(err, user) {
            if(user) {
                var history = {};
                for(var h in user.history) {
                    history[h] = user.history[h];
                }

                history[req.args.key] = req.args.val || true;
                user.history = history;

                user.save();
            }
            done(err, {history: user ? user.history : null});
        });
    }
};
