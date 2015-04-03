var WIT_ACCESS_TOKEN = process.env.WIT_TOKEN || '';
var TWILIO_SID = process.env.TWILIO_SID || '';
var TWILIO_KEY = process.env.TWILIO_KEY || '';
var TWILIO_NUMBER = '+14085121069';
var CLOUDINARY_SECRET = process.env.CLOUDINARY_SECRET || '';
var NUMBERS_DRIVE = ['+14088568812'];

var EVENTS = ['2015utwv', '2015casj'];
var EVENT_DEFAULT = '2015casj';

var express = require('express');
var bodyParser = require('body-parser');
var tba = require('tba')('frc115', 'Scouting App', '0.1');
var firebase = require('firebase');
var twilio = require('twilio')(TWILIO_SID, TWILIO_KEY);
var wit = require('node-wit');
var cloudinary = require('cloudinary');
var moment = require('moment');

cloudinary.config({
  cloud_name: 'theakhil',
  api_key: '884819557627848',
  api_secret: CLOUDINARY_SECRET
});

var ref = new firebase('https://scouting115.firebaseio.com');

var app = express();
app.use(bodyParser.urlencoded({
  extended: false
}));

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

app.get('/', function(request, response) {
  response.send('Hello World!');
});

app.post('/load-scores', loadScoresPOST);

app.post('/load-teams', loadTeamsPOST);

app.post('/load-sched', loadSchedulePOST);

app.post('/save-images', saveImagesPOST);

app.get('/team-matches', getTeamMatchesGET);

app.get('/team-nextmatch', getNextTeamMatchGET);

app.get('/team-lastmatch', getLastTeamMatchGET);

app.post('/sms-recvai', smsAI);

app.post('/tba-webhook', tbaWebHook);

app.use('/pitview/', express.static(__dirname + '/public'));


app.listen(app.get('port'), function() {
  console.log('HEY!!! Node app is running at localhost:' + app.get('port'));
});

function loadSchedulePOST(request, res){
    console.log('POST load schedule');

  var event = request.body.event;

  if(event == null){
      res.status(422).send('Missing event parameter');
      return;
  }

  loadSchedule(event);

  res.send('Attempted loading data from ' + event + '!');

}

function loadTeamsPOST(request, res){
  console.log('POST load teams');

  var event = request.body.event;

  if(event == null){
      res.status(422).send('Missing event parameter');
      return;
  }

  tba.getEventTeams(event, function(error, data){
      for(var i in data){
        var team = data[i];
        var key = team.key;
        ref.child('teams').child(key).set({
          name: team.name,
          nick: team.nickname,
          number: team.team_number,
          location: team.location,
          website: team.website
        });
      }
  });

  res.send('Attempted loading data from ' + event + '!');

}

function loadScoresPOST(request, res){
  console.log('POST load scores');

  var event = request.body.event;

  if(event == null){
      res.status(422).send('Missing event parameter');
      return;
  }

  tba.getEventMatches(event, function(error, data){
      var sched = ref.child('sched');
      for(var i in data){
        var match = data[i];
        var key = match.key;
        if(match.alliances.blue.score != null &&  match.alliances.blue.score != -1){
          var blueScore = match.alliances.blue.score;
          var redScore = match.alliances.red.score;
          var breakdown = match.score_breakdown;
          ref.child('scores').child(key).set({
            b: blueScore,
            r: redScore,
            breakdown: breakdown
          });
        }
      }
  });

  res.send('Attempted loading scores for ' + event);

}

function saveImagesPOST(request, response){
    ref.child('pitscout/images').on('child_added', function(data){
        if(data.val() == null){
            response.send('error');
            return;
        }

        var url = data.val().url;
        var cloud = data.val().cloudinary_url;
        if(url == null || url == '')return;
        if(cloud != null && cloud != '')return;

        cloudinary.uploader.upload(url, function(result) {
            var newUrl = result.url;
            console.log(data.ref().toString());
            data.ref().update({
                cloudinary_url: newUrl
            });
        });
    });

    response.send('attempted to save');
}

function getTeamMatchesGET(request, res){
    console.log('GET team match info');

    var team = request.query.team;
    var event = request.query.event;

    console.log('team: ' + team + ', event: ' + event);

    if(event == null || team == null){
        res.status(422).send('Missing event parameter');
        return;
    }

    if(team.indexOf('frc') === -1)team = 'frc' + team;

    getTeamMatches(team, event, function(matches){
        if(matches.length == 0){
            res.status(404).send('No matches found');
        }else{
            console.log(JSON.stringify(matches));
            res.send(readableMatches(matches));
        }
    });
}

function getNextTeamMatchGET(request, res){
    console.log('GET next team match');

    var team = request.query.team;
    var event = request.query.event;

    if(event == null || team == null){
        res.status(422).send('Missing event parameter');
        return;
    }
    getNextTeamMatch(team, event, function(text, nextMatch, partners, opp){
        if(text == null)res.status(404).send('No match found');
        else res.send(text);
    });
}

function getLastTeamMatchGET(request, res){
    console.log('GET last team match');

    var team = request.query.team;
    var event = request.query.event;

    if(event == null || team == null){
        res.status(422).send('Missing event parameter');
        return;
    }

    getTeamLastScore(team, event, function(toSay){
        res.send(toSay);
    });


}

function tbaWebHook(request, response){
    var index = [];
    for(var x in request.body){
        index.push(x);
        console.log('x: ' + x + ' endx');
    }
    var data = JSON.parse(index[0]);

    if(data.message_type == 'match_score'){
        var event_key = data.message_data.match.event_key;
        if(EVENTS.indexOf(event_key) == -1){
            console.log('bad event: ' + event_key);
        }else{
            response.send(tbaMatchScore(data));
            sendUpdate();
        }
    }else if(data.message_type == 'schedule_updated'){
        var event_key = data.message_data.event_key;
        if(EVENTS.indexOf(event_key) == -1){
            console.log('useless event: ' + event_key);
        }else{
            loadSchedule();
            response.send('attempted updating schedule');
        }
    }

}

function tbaMatchScore(data){
    var event = data.message_data.match.event_key;
    var match = data.message_data.match.key;
    console.log('event: ' + event + ', match: ' + match);
    if(event == null || match === null)return('Error saving');
    ref.child('events').child(event).set({
        lastMatch: match
    });
    saveScore(data);
    sendUpdate(data);
    return ('Updated matches');
}

function saveScore(data){
    var match = data.message_data.match.key;
    ref.child('scores').child(match).set({
        b: data.message_data.match.alliances.blue.score,
        r: data.message_data.match.alliances.red.score,
        breakdown: data.message_data.match.score_breakdown
    });
}

function sendUpdate(){
    console.log('Checking to send update');
    var match = data.message_data.match.key;
    getLatestMatch(EVENT_DEFAULT, function(latest){
        console.log('SendUpdate latest: ' + latest);
        getNextTeamMatch(115, EVENT_DEFAULT, function(text, next, part, opp){
            console.log('SendUpdate next for 115: ' + text);
            if(next == null)return;
            else dist = compare(latest, next);
            if(dist < 4){
                var matchNo = next.split('_')[1];
                for(number in NUMBERS_DRIVE){
                    console.log('Sending friendly reminder');
                    sendSMS(number, 'Just a friendly reminder: match ' + matchNo + ' is only ' + dist + ' matches away!');
                }
            }
        });
    });
}

function smsAI(request, response){
    var body = request.body.Body;
    var sender = request.body.From;
    var numMedia = request.body.NumMedia;
    console.log('body.body: ' + body);

    if(numMedia > 0){
        respond(response, handleMedia(sender, body, request.body, numMedia));
        return;
    }

    wit.captureTextIntent(WIT_ACCESS_TOKEN, body, function (err, res) {
         if (err){
             console.log('Wit err: ' + err);
             respond(response, 'Sorry, I did not understand what you were asking for');
         }else{
             console.log('Wit data: ' + JSON.stringify(res));
             var intent = res.outcomes[0].intent;

             if(intent == 'match_info'){
                 var match = res.outcomes[0].entities.match;
                 if(match == null || match.length == 0){
                     respond(response, 'Sorry, I did not understand what you were asking for');
                     return;
                 }
                 smsGetMatchInfo(match[0].value, response);
                 return;
             }

             if(res.outcomes[0].entities.team == null || res.outcomes[0].entities.team.length == 0){
                 respond(response, 'Sorry, I did not understand what you were asking for');
                 return;
             }
             var team = 'frc' + res.outcomes[0].entities.team[0].value;
             if(intent == 'team_nextmatch')smsNextMatch(team, EVENT_DEFAULT, response);
             if(intent == 'team_lastmatch')smsLastMatch(team, EVENT_DEFAULT, response);
             if(intent == 'team_listmatches')smsTeamMatches(team, EVENT_DEFAULT, response);
             if(intent == 'teamstats')smsGetTeamStats(team, EVENT_DEFAULT, response);
         }
    });
}

function respond(response, message) {
    var toSend = '<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n<Response>\n<Message>' + message +
    '</Message>\n</Response>';
    response.send(toSend);
}

function smsNextMatch(team, event, response){
    getNextTeamMatch(team, event, function(res, next, partners, opp){
        respond(response, res);
    });
}

function smsLastMatch(team, event, response){
    getTeamLastScore(team, event, function(toSay){
        respond(response, toSay);
    });
}

function smsTeamMatches(team, event, response){
    getTeamMatches(team, event, function(matches){
        if(matches.length == 0)respond(response, 'No matches could be found for team ' + team);
        else{
            var formatted = readableMatches(matches);
            respond(response, 'Matches for team ' + team + ': ' + formatted);
        }
    });
}

function smsGetTeamStats(team, event, response){
    getTeamStats(team, event, function(res){
        respond(response, res);
    });
}

function smsGetMatchInfo(match, response){
    var fullMatch = EVENT_DEFAULT + '_' + match;
    getMatchInfo(fullMatch, function(red, blue){
        if(red == null || blue == null)respond(response, 'Couldn\'t find match info');
        else respond(response, 'Info for match ' + match + ': red alliance: ' + red + ', blue: ' + blue);
    });
}

function loadSchedule(event){
    tba.getEventMatches(event, function(error, data){
        var sched = ref.child('sched');
        for(var i in data){
          var match = data[i];
          var matchNo = match.key;
          var blue = match.alliances.blue.teams;
          var red = match.alliances.red.teams;
          for(var b in blue){
            var team = blue[b];
            var id = team + ':' + matchNo;
            sched.child(id).set({
                alliance: 'b',
                event: event,
                match: matchNo,
                team: team,
                time: match.time
            });
          }
          for(var r in red){
            var team = red[r];
            var id = team + ':' + matchNo;
            sched.child(id).set({
                alliance: 'r',
                event: event,
                match: matchNo,
                team: team,
                time: match.time
            });
          }
        }
    });
}

function getTeamMatches(team, event, callback){
    console.log('getTeamMatches() ==> getting matches for team: ' + team + ' at ' + event);

    var sched = ref.child('sched');
    sched.orderByChild('team').equalTo(team).once('value', function(snapshot){

        var matches = [];

        snapshot.forEach(function(childSnapshot) {
            var match = childSnapshot.val();
            if(match.event == event){
                matches.push(match.match);
            }
        });

        callback(matches);

    });
}

function getTeamLastScore(team, event, callback){

    console.log('getTeamLastScore() ==> getting the last score for team ' + team + ' at ' + event);

    getLastTeamMatch(team, event, function(lastMatch){
        if(lastMatch == null){
            callback('No previous matches found for team ' + team);
            return;
        }

        var key = team + ':' + lastMatch;
        ref.child('sched').orderByKey().equalTo(key).once('value', function(sched){
            if(sched.val() == null){
                callback('Error getting schedule. Let Akhil know so he can fix it!');
                return;
            }

            var alliance = sched.child(key).val().alliance;

            ref.child('scores').child(lastMatch).once('value', function(snapshot){

                var match = lastMatch.split('_')[1];

                if(snapshot.val() == null){
                    callback('No scores found, but ' + team + '\'s last match was ' + match);
                    return;
                }
                var score = snapshot.val()[alliance];
                callback('Team ' + team + '\'s last match was ' + match + ', where they scored ' + score);

            });
        });
    });
}

function getLastTeamMatch(team, event, callback){
    console.log('getLastTeamMatch() ==> Getting last match for team ' + team + ' at ' + event);

    getLatestMatch(event, function(latest){
        getTeamMatches(team, event, function(matches){
            var minDist = 6000;
            var lastMatch = null;
            matches.forEach(function(match){
                var dist = compare(match, latest);
                //if this match has already happened
                if(dist > 0 && dist < minDist){
                    minDist = dist;
                    lastMatch = match;
                }
            });
            callback(lastMatch);
        });
    });
}

function getNextTeamMatch(team, event, callback){
    console.log('getNextTeamMatch() ==> Getting next match for team ' + team + ' at ' + event);
    getLatestMatch(event, function(latest){
        if(latest == null){
            callback('Error finding match data... Let Akhil know, so he can fix it!', null, null, null);
            return;
        }
        getTeamMatches(team, event, function(matches){
            var minDist = 6000;
            var nextMatch = null;
            matches.forEach(function(match){
                var dist = compare(latest, match);
                //if this match hasn't happened yet
                if(dist > 0 && dist < minDist){
                    minDist = dist;
                    nextMatch = match;
                }
            });

            if(nextMatch == null){
                callback('Whoops! There was an error getting the next match. Let Akhil know so he can fix it.', null, null, null);
            }

            var matchNo = nextMatch.split('_')[1];

            getAlliancePartners(team, nextMatch, function(partners, opp){
                if(partners == null){
                    callback('The next match for team ' + team + ' is ' + matchNo +
                    ', but I couldn\'t find their alliance partners', nextMatch, partners, opp);
                }else{
                    callback('The next match for team ' + team + ' is ' + matchNo + ', with teams '
                        + partners + ' and opposite alliance ' + opp, nextMatch, partners, opp);
                }
            });
        });
    });
}


function getAlliancePartners(team, match, callback){
    ref.child('sched/' + team + ':' + match).once('value', function(data){
        if(data.val() == null){
            callback(null);
            return;
        }
        var alliance = data.val().alliance;
        var teams = [];
        var opp = [];

        ref.child('sched').orderByChild('match').equalTo(match).once('value', function(snapshot){
            snapshot.forEach(function(child){
                var data = child.val();
                if(data == null)return;
                var all = data.alliance;
                if(all == alliance){
                    teams.push(data.team);
                }else opp.push(data.team);
            });

            callback(teams, opp);
        });
    });
}

function getMatchInfo(match, callback){
    ref.child('sched').orderByChild('match').equalTo(match).once('value', function(snapshot){
        var red = [];
        var blue = [];
        snapshot.forEach(function(child){
            var data = child.val();
            if(data == null){
                return;
            }
            if(data.alliance == 'r'){
                red.push(data.team);
                console.log('red');
            }else {
                blue.push(data.team);
                console.log('blue');
            }
        });
        callback(red, blue);
    });
}

function getLatestMatch(event, callback){
    console.log('getLatestMatch() ==> getting the latest match at event ' + event);

    ref.child('events').child(event).once('value', function(data){
        if(data.val() == null){
            callback(null);
            return;
        }
        callback(data.val().lastMatch);
    });
}

function getTeamStats(team, event, callback){
    team = team.match(/\d+/)[0]; //get only number

    tba.getEventStats(event, function(error, data){

        if(data == null){
            callback('Error retrieving stats data from TBA. Note that it might not have been published yet.');
            return;
        }

        var opr = data.oprs[team];
        var ccwm = data.ccwms[team];

        if(opr == null || ccwm == null){
            callback('Error retrieving stats data from TBA. Note that it might not have been published yet.');
            return;
        }

        tba.getEventRankings(event, function(err, rankings_list){
            for(var rank = 0; rank < rankings_list.length; rank++){
                if(rankings_list[rank][1] == team){
                    var data = rankings_list[rank];
                    var qualAvg = data[2];
                    var auto = data[3];
                    var container = data[4];
                    var coop = data[5];
                    var litter = data[6];
                    var tote = data[7];
                    var played = data[8];
                    var info = 'Info for team ' + team + ': ' +
                        'Quals Avg: ' + qualAvg +
                        ', Auton: ' + auto +
                        ', Container: ' + container +
                        ', Coop: ' + coop +
                        ', Litter: ' + litter +
                        ', Tote: ' + tote +
                        ', Games Played: ' + played +
                        ', OPR: ' + opr +
                        ', CCWM: ' + ccwm;
                    callback(info);
                    return;
                }
            }
            callback('Error getting stats for team ' + team);
        });
    });
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

function addImage(team, msg, url, sender) {
    ref.child('pitscout/images').push({
        'url': url,
        'msg': msg,
        'sender': sender,
        'team': team
    });
}

/**
  Calculates the 'distance' between two matches
  if match1 is before match2, return value is > 0
  if match1 is after match2, return value is < 0
  if match1 is equal to match2, return value is 0
*/
function compare(match1, match2){
    return getMatchVal(match2) - getMatchVal(match1);
}

function getMatchVal(match){
    console.log('getMatchVal() ==> getting value of match: ' + match);

    var event = match.split('_')[0];
    var match = match.split('_')[1];

    var matchType = match.match(/^\D+/);

    var numbers = match.match(/^\d+|\d+\b|\d+(?=\w)/g);

    var val = 0;
    if(matchType == 'qf')val = 1000;
    else if(matchType == 'sf')val = 2000;
    else if(matchType == 'f')val = 3000;

    if(numbers.length < 2)val += parseInt(numbers[0]);
    else val += parseInt(numbers[1]) + 10 * parseInt(numbers[0]);

    console.log('getMatchVal() ==> the value of match ' + match + ' is ' + val);
    return val;
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

function readableMatches(matches){
    var finished = "";

    while(matches.length > 0){
        var minPos = 0;
        console.log(matches);
        for(var i = 1; i < matches.length; i++){
            var minDist = compare('2015_qm0', matches[minPos]);
            if(compare('2015_qm0', matches[i]) < minDist){
                minPos = i;
            }
        }
        var match = matches.splice(minPos, 1);
        match = (match + '').split('_')[1];
        finished += match;
        if(matches.length > 0)finished += ', ';
    }
    return finished;
}
