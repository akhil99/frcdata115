var express = require('express');
var bodyParser = require('body-parser');
var firebase = require('firebase');
var wit = require('node-wit');
var tba = require('thebluealliance');

var myFirebaseRef = new firebase('https://scouting115.firebaseio.com');

var WIT_ACCESS_TOKEN = 'BWX5KFWA575EKWO7NHV5VUYXVAYADOQE';

var app = express();
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({
    extended: true
})); // to support URL-encoded bodies

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

app.get('/', function(request, response) {
  response.send('Hello There! This might actually work!');
});

app.post('/sms-recv', ai);

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
});

function respond(response, message) {
    var toSend = '<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n<Response>\n<Message>' + message +
    '</Message>\n</Response>';
    response.send(toSend);
}

function ai(request, response){
    var body = request.body.Body;
    wit.captureTextIntent(WIT_ACCESS_TOKEN, body, function (err, res) {
         if (err){
             console.log('Wit Error: ', err);
         }else{
             console.log('Wit data: ' + res);
             var intent = res.outcomes.intent;
             if(intent === 'teamstats')teamstats(res);
         }
    });
    response.send("HEY!!");
}

function teamstats(res){
    console.log("teamstats");
    var team = res.outcomes.entities.team;
    tba.getStatsAtEvent("2015utwv", function(err, stats){
        var opr = stats.oprs[team];
        var ccwm = stats.ccwms[team];
    });

    tba.getRankingsAtEvent("2015utwv", function(err, rankings_list){
        for(var rank = 0; rank < rankings_list.length; rank++){
            if(rankings_list[rank][1] === team){
                var data = rankings_list[rank];
                var qualAvg = data[2];
                var auto = data[3];
                var container = data[4];
                var coop = data[5];
                var litter = data[6];
                var tote = data[7];
                var played = data[8];
                var info = "Info for team " + team + ": " +
                    "Quals Avg: " + qualAvg +
                    ", Auton: " + auton +
                    ", Container: " + container +
                    ", Coop: " + coop +
                    ", Litter: " + litter +
                    ", Tote: " + tote +
                    ", Games Played: " + played;
                console.log(info);
            }
        }
    });
}

function pitScout(request, response){
    var sender = request.body.From;
    var body = request.body.Body;
    var numMedia = request.body.NumMedia;

    if(numMedia > 0)respond(response, handleMedia(sender, body, request.body, numMedia));
    else respond(response, handleComment(sender, body, numMedia));
}

function handleMedia(sender, body, requestBody, numMedia) {
    var teamAndComments = getTeamAndComments(body);
    var team = teamAndComments.team;
    var msg = teamAndComments.msg;

    if(team == null || msg == null) {
        return 'Please use the following format (note the comma):\n[team #], [comments, if any]';
    }

    for(i = 0; i < numMedia; i++) {
        addImage(team, msg, requestBody['MediaUrl' + i], sender);
    }
    return 'Media successfully saved!';

}

function handleComment(sender, body) {
    var teamAndComments = getTeamAndComments(body);
    var team = teamAndComments.team;
    var msg = teamAndComments.msg;
    console.log("team: " + team + ", msg: " + msg);
    if(team == null || team == NaN || msg == null || msg == '') {
        return 'Please use the following format (note the comma):\n[team #], [comments]';
    }

    addComments(team, msg, sender);

    return 'Comment successfully saved!';
}

function addComments(team, message, sender) {
    myFirebaseRef.child('pitscout/comments').push({
        'comment': message,
        'sender': sender,
        'team':team
    });
}

function addImage(team, msg, url, sender) {
    myFirebaseRef.child('pitscout/images').push({
        'url': url,
        'msg': msg,
        'sender': sender,
        'team': team
    });
}


function getTeamAndComments(body) {
    body = body.trim();

    if(!isNaN(body) && body !== '') {
        console.log('body is a number');
        return { team: parseInt(body), msg: '' }
    }

    var comma = body.indexOf(',');
    team = body.substr(0, comma);
    if(!isNaN(team) && team !== '') {
        console.log("team is a number");
        return{
            team: parseInt(team),
            msg: body.substr(comma + 1).trim()
        }
    }

    return {
        team: null,
        msg: null
    }
}
