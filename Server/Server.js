/**
 * Created by navid on 2/28/17.
 */

//REQUIREMENTS -->
var express = require("express");
var bodyParser = require('body-parser');
var multer = require('multer'); // v1.0.5
var chalk = require('chalk');
var DBMiddleware = require("./Database_Middleware.js");
var Mailer = require("./Mailer");
var code_generator = require("./UUID_Generator");
var upload = multer(); // for parsing multipart/form-data
var app = express();
var http = require("http");
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded
app.set("view engine" , "ejs");
//INIT -->
DBMiddleware.connect();
var localaddr = "192.168.43.201";
var localhost = "localhost";
var address = localhost;
var port = 3001;
logged_users = [];//logged users

//this function sends the confirmation code to a user provided his username
function send_confirmation_code(userdata, callback) {
    console.log(chalk.yellow("Server:send-confirm >>> ") + chalk.white("sending confirmation code"));

    //fetch the user data
    DBMiddleware.fetch_user_prime_data(userdata, function (error, result) {

        //check there is no problem with fetching
        if (error == null) {
            if (result == null)
                callback(new Error("Not Found"), null);
            else {

                //generate a code
                code_generator.generate_short_id(function (code) {

                    result.confirmation_code = code;
                    //set the generated confirm code in database too
                    DBMiddleware.set_confirm_code(result, function (my_error, my_result) {
                    });

                    //ask mailer module to send the generated confirmation code
                    Mailer.send_confirmation_code(result, function (error, info) {

                        //check if there is any error with mailing
                        if (error == null)
                            callback(null, info);//if there is no problem with mailing , call callback with additional info
                        else
                            callback(error);//if there was a problem , call callback with error
                    });
                })
            }
        } else {
            //if fetching has a problem
            callback(new Error(error.toString()), null);
        }

    });
}

//check server
app.get("/", function (req, res) {
    console.log(chalk.yellow("Server:get >>> ") + chalk.white("checking for server status"));
    reply = {"status": 1, "content": null};
    res.send(reply);
});

//user registration api
//request format :{ username , first_name , last_name , email , password }
//response format :{ status , content }
app.post("/user/", function (req, res) {
    console.log(chalk.yellow("Server:user-post >>> ") + chalk.white("registering a user"));

    reply = {"status": 0, "content": null};
    //register in database
    DBMiddleware.register_user(req.body, function (error, info) {
        if (error){
            reply.content = error.toString();
            res.send(reply);
        }
        else {
            //send the confirmation code to registered-user's email
            send_confirmation_code(req.body, function (error, info) {
                if (error){
                    reply.content = error.toString();
                    res.send(reply);
                }
                else {
                    reply.status = 1;
                    reply.content = "registered successfully";
                    res.send(reply);
                }
            });
        }
    });
});

//getting user full info api
app.get("/user/:id", function (req, res) {
    console.log(chalk.yellow("Server:user-get >>> ") + chalk.white("someone tries to log in"));
    data = DBMiddleware.fetch_user_prime_data({"username": req.params.id}, function (error, result) {
        console.log("DATA IS \n" + result);
        res.send(result)
    });
});

//user authentication api
//request format : {username , password}
//response format : {status , content} content contains a key which is needed during the session and needs to be passed
//future requests
app.put("/user/", function (req, res) {
    console.log(chalk.yellow("Server:user-put >>> ") + chalk.white("checking log in info"));

    //scrap content from request
    password = req.body.password;
    username = req.body.username;

    //forge reply
    reply = {"status": 0, "content": null};

    //ask the db middleware to check for correctness
    userdata = DBMiddleware.check_user_password({
        "username": username,
        "password": password
    }, function (error, results) {
        if (error) {
            res.status(406);
            reply.content = error.toString();
            res.send(reply);
        }
        else if (results == true) {

            reply.status = 1;
            //generate a key to use
            code_generator.generate_short_id(function (id) {
                reply.content = id;
                res.send(reply);
                logged_users.push({"username": username, "key": id});
            });
        }
        else{
            reply.content = "username or password incorrect.Try again" ;
            res.send(reply);
        }


    });

});

//log out procedure
app.unlink("/user/", function (req, res) {
    username = req.body.username;
    for (i = 0; i < logged_users.length; i++) {
        if (logged_users[i].username == username)
            logged_users.splice(i, 1);
    }
    res.send("Bye");
});

//check if a given confirmation code matches
//request format : {username , confirmation_code }
app.put("/confirmation/", function (req, res) {
    console.log(chalk.yellow("Server:confirmation-put >>> ") + chalk.white("checking if conf codes match?"));

    //scrap given confirmation code from request
    confirmation_code = req.body.confirmation_code;
    username = req.body.username;


    //forge reply template
    reply = {"status": 0, "content": null};

    //check if user have given a confirmation code and a username pr not
    if (confirmation_code == null || username == null) {
        reply.content = "no confirmation or username specified";
        res.send(reply);
    } else {  //if there is a confirmation code in request

        //ask db to get the confirmation code
        DBMiddleware.fetch_confirm_code(req.body, function (error, result) {
            if (error == null) {
                fetched_conf_code = result.confirm_code;

                //check if they are equal or not
                if (fetched_conf_code == confirmation_code) {
                    DBMiddleware.set_confirm_code_status(req.body, 1, function (error, info) {
                        if (error){
                            reply.content = error.toString();
                            res.send(reply);
                        }
                        else {
                            reply.status = 1;
                            reply.content = "confirm code matches";
                            res.send(reply);
                        }
                    });
                } else {
                    reply.content = "confirmation code mismatches or user does not exist!";
                    res.send(reply);
                }
            }
            else {
                reply.content = error.toString();
                res.send(reply);
            }
        });

    }


});

//resending confirmation code to an specific username
//request format : {username}
app.post("/confirmation/", function (req, res) {
    console.log(chalk.yellow("Server:confirmation-post >>> ") + chalk.white("asking for resending confirmation code"));

    //scrap username from req body
    username = req.body.username;

    //forge a proper reply template
    reply = {"status": 0, "content": null};

    //check for the request body content is as required
    if (username == null) {
        {
            reply.content = "no username specified";
            res.send(reply);
        }
    } else {
        //send conf code
        send_confirmation_code(req.body, function (error, info) {
            if (error){
                reply.content = error.toString();
                res.send(reply);
            }
            else {
                reply.status = 1;
                reply.content = "confirmation code sent";
                res.send(reply);
            }
        });
    }


});

//send a message procedure
//request format : {sender , receiver , content , key , subject} key is a valued that server gives to logged-in users
//and is used for identification during the session
app.post("/message/", function (req, res) {

    console.log(chalk.yellow("Server:message-post >>> ") + chalk.white("sending message"));

    subject = req.body.subject;
    receiver = req.body.receiver;
    content = req.body.content;
    sender = JSON.stringify(req.body.sender);
    key = JSON.stringify(req.body.key);

    console.log("1- =>" + JSON.stringify(req.body));

    //create a template for reply
    reply = {"status": 0, "content": null};

    //check for the requirements
    if (subject == null || receiver == null || content == null || sender == null){
        res.status = 406 ;
        reply.content = "some message component is missing" ;
        res.send(reply);
    }
    else {
        var i = 0;
        for (i = 0; i < logged_users.length; i++) {
            //check if the request is from logged users or not
            if (JSON.stringify(logged_users[i].username) == sender && key == JSON.stringify(logged_users[i].key)) {
                DBMiddleware.send_message(req.body, function (error, info) {
                    if (error){
                        reply.content = error.toString();
                        res.send(reply);
                    }

                    else {
                        reply.content = "message sent";
                        reply.status = 0;
                        res.send(reply);
                    }
                });
                break;
            } else if (logged_users.username == sender) {
                reply.content = sender + " please log in first";
                res.send(reply);
            }
        }
        if (i == logged_users){
            reply.content = "please log in with your username first";
            res.send(reply);
        }
    }
});

//fetch inbox message subjects and their state which indicates it is read or not
//request format : {key , username}
//response format : {status , content(if authentication was right content holds a set of this values) : { subject  , is_checked} }
app.put("/message/inbox/", function (req, res) {
    console.log(chalk.yellow("Server:message/inbox-put >>> ") + chalk.white("fetch inbox subjects"));

    key = JSON.stringify(req.body.key);
    username = JSON.stringify(req.body.username);

    reply = {"status": 0, "content": null};

    var i = 0;
    for (i = 0; i < logged_users.length; i++) {
        cur_logged_username = JSON.stringify(logged_users[i].username);
        cur_logged_key = JSON.stringify(logged_users[i].key);
        if (username == cur_logged_username && key == cur_logged_key) {
            break;
        }
    }
    if (i == logged_users.length){
        reply.content = "user has not logged yet!";
        res.send(reply);
    }
    else
        DBMiddleware.fetch_user_inbox_subjects(req.body, function (error, result) {
            if (error){
                reply.content = error.toString();
                res.send(reply);
            }
            else {
                reply.status = 1;
                reply.content = result;
                res.send(reply);
            }
        });


});

//fetch inbox message subjects and their state which indicates it is read or not
//request format : {key , username}
//response format : {status , content(if authentication was right content holds a set of this values) : { subject } }
app.put("/message/outbox/", function (req, res) {
    console.log(chalk.yellow("Server:message/sent-put >>> ") + chalk.white("fetch sent subjects"));

    key = JSON.stringify(req.body.key);
    username = JSON.stringify(req.body.username);

    reply = {"status": 0, "content": null};

    var i = 0;
    for (i = 0; i < logged_users.length; i++) {
        cur_logged_username = JSON.stringify(logged_users[i].username);
        cur_logged_key = JSON.stringify(logged_users[i].key);
        if (username == cur_logged_username && key == cur_logged_key) {
            break;
        }
    }
    if (i == logged_users.length){
        reply.content = "please log in first";
        res.send(reply);
    }
    else
        DBMiddleware.fetch_user_sent_subjects(req.body, function (error, result) {
            if (error){
                res.status(406);
                reply.content = error.toString();
                res.send(reply); //TODO : send proper message
            }
            else {
                reply.status = 1;
                reply.content = result;
                res.send(reply);
            }
        });


});


//fetch a specific message provided it's subject from inbox
//request format : {key , username , subject}
//response format :
// {content , subject  , date , time , receiver_username , sender_username} + (some other garbage attributes which is set to "-1")
app.post("/message/inbox/", function (req, res) {
    //take necessary parameters
    key = JSON.stringify(req.body.key);
    username = JSON.stringify(req.body.username);

    //forge a reply template
    reply = {"status": 0, "content": null};

    //check if the user has already logged in
    var i = 0;
    for (i = 0; i < logged_users.length; i++) {
        cur_logged_username = JSON.stringify(logged_users[i].username);
        cur_logged_key = JSON.stringify(logged_users[i].key);
        if (username == cur_logged_username && key == cur_logged_key) {
            break;
        }
    }
    if (i == logged_users.length){
        reply.content = "please log in first";
        res.send(reply);
    }
    else {
        DBMiddleware.fetch_inbox_message_content(req.body , function(error , result){
            if (error){
                //send back a proper error
                res.status(406);
                reply.content = error.toString();
                res.send(reply);
            }else{
                //if everything was alright ...

                reply.status = 1 ;
                var id = result.message_id;
                var is_checked = result.is_checked ;

                //set garbage attributes
                result.message_id = -1 ;
                result.id = -1 ;
                result.is_checked = -1  ;

                //send back the result
                reply.content = result ;
                res.send(reply);

                //if the user has not checked message before mark it as checked
                if(is_checked == 0)
                    DBMiddleware.check_message(id , function (err ,result) {});
            }
        });
    }

});

//fetch a specific message from outbox
//request format : {key , username , subject}
//response formate :
// {content , subject  , date , time , receiver_username , sender_username} + (some other garbage attributes which is set to "-1")
app.post("/message/outbox/", function (req, res) {

    key = JSON.stringify(req.body.key);
    username = JSON.stringify(req.body.username);


    reply = {"status": 0, "content": null};

    var i = 0;
    for (i = 0; i < logged_users.length; i++) {
        cur_logged_username = JSON.stringify(logged_users[i].username);
        cur_logged_key = JSON.stringify(logged_users[i].key);
        if (username == cur_logged_username && key == cur_logged_key) {
            break;
        }
    }
    if (i == logged_users.length){
        reply.content = "please log in first";
        res.send(reply);
    }
    else {
        DBMiddleware.fetch_outbox_message_content(req.body , function(error , result){
            if (error){
                res.status(406);
                res.send(reply.content = error.toString());
            }else{
                reply.status = 1 ;
                reply.content = result ;
                console.log(chalk.red(" result >>> ") + "       " + JSON.stringify(result));
                res.send(reply)
            }
        });
    }

});


//test
app.get("/admin/", function (req, res) {
    console.log(chalk.yellow("Server:admin >>> ") + chalk.white("logged in users") + chalk.green(logged_users.length));
    for (var i = 0; i < logged_users.length; i++)
        console.log("   =>" + JSON.stringify(logged_users[i]));
    res.send("ok");
});

//server initiation
var server = app.listen(port, address, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log("Server is listening at http://%s:%s", host, port);
});

var connectedUsers = [];
