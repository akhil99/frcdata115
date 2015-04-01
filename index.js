var WIT_ACCESS_TOKEN = process.env.WIT_TOKEN || '';
var TWILIO_SID = process.env.TWILIO_SID || '';
var TWILIO_KEY = process.env.TWILIO_KEY || '';
var TWILIO_NUMBER = '+14085121069';

var EVENT_DEFAULT = '2015utwv';

var express = require('express');
var bodyParser = require('body-parser');
var tba = require('tba')('frc115', 'Scouting App', '0.1');
var firebase = require('firebase');
var twilio = require('twilio')(TWILIO_SID, TWILIO_KEY);
var wit = require('node-wit');

var ref = new firebase("https://scouting115.firebaseio.com");

var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

app.set('port', (process.env.PORT || 5000));
app.use(express.static(__dirname + '/public'));

app.get('/', function(request, response) {
  response.send('Hello World!');
});

app.post('/load-scores', loadScoresPOST);

app.post('/load-sched', loadSchedulePOST);

app.post('/load-teams', loadTeamsPOST);

app.get('/team-matches', getTeamMatchesGET);

app.get('/team-nextmatch', getNextTeamMatchGET);

app.get('/team-lastmatch', getLastTeamMatchGET);

app.post('/sms-recvai', smsAI);

app.listen(app.get('port'), function() {
  console.log("HEY!!! Node app is running at localhost:" + app.get('port'));
});

function loadSchedulePOST(request, res){
    console.log('POST load schedule');

  var event = request.body.event;

  if(event == null){
      res.status(422).send('Missing event parameter');
      return;
  }

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
          });
        }
      }
  });

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
        if(match.alliances.blue.score != null){
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
          res.send(JSON.stringify(matches));
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
    getNextTeamMatch(team, event, function(nextMatch){
        if(nextMatch == null)res.status(404).send('No match found');
        else res.send(nextMatch);
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


}

function smsAI(request, response){
    var body = request.body.Body;
    var sender = request.body.From;
    wit.captureTextIntent(WIT_ACCESS_TOKEN, body, function (err, res) {
         if (err){
             console.log('Wit Error: ', err);
         }else{
             console.log('Wit data: ' + JSON.stringify(res));
             var intent = res.outcomes[0].intent;
             var team = res.outcomes[0].entities.team[0].value;
             if(intent == 'team_nextmatch')smsNextMatch(team, EVENT_DEFAULT, sender, response);
         }
    });
}

function smsSend(msg, recipient){
    twilio.messages.create({
        body: msg,
        to: recipient,
        from: TWILIO_NUMBER
    }, function(err, msg){});
}

function respond(response, message) {
    var toSend = '<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n<Response>\n<Message>' + message +
    '</Message>\n</Response>';
    response.send(toSend);
}

function smsNextMatch(team, event, sender, response){
    getNextTeamMatch(team, event, function(match){
        if(match == null){
            respond('No next match could be found');
        }
        else{
            var matchNo = match.split('_')[1];
            respond('The next match for team ' + team + ' is ' + matchNo);
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
        getTeamMatches(team, event, function(matches){
            var minDist = 6000;
            var lastMatch = null;
            matches.forEach(function(match){
                var dist = compare(latest, match);
                //if this match hasn't happened yet
                if(dist > 0 && dist < minDist){
                    minDist = dist;
                    lastMatch = match;
                }
            });
            callback(lastMatch);
        });
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

function getTeamLastScore(team, event, callback){

    console.log('getTeamLastScore() ==> getting the last score for team ' + team + ' at ' + event);

    getLastTeamMatch(team, event, function(lastMatch){
        if(lastMatch == null){
            callback(null);
            return;
        }

        var key = team + ':' + lastMatch;
        ref.child('sched').orderByKey().equalTo(key).once('value', function(sched){
            if(sched.val() == null){
                res.status(404).send('Error');
                return;
            }

            var alliance = sched.child(key).val().alliance;

            ref.child('scores').child(lastMatch).once('value', function(snapshot){
                if(snapshot.val() == null){
                    res.status(404).send('No scores found');
                    return;
                }

                var score = snapshot.val()[alliance];
                var match = lastMatch.split('_')[1];
                var info = 'Team ' + team + '\'s last match was ' + match
                    + ', where they scored ' + score;
                callback(info);
            });
        });
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
