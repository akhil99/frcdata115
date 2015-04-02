var ref = new Firebase('https://scouting115.firebaseio.com/');

function loadTeam(team){
    ref.child('pitscout/images').orderByChild('team').equalTo(team).on('child_added', function(snapshot) {
        var img = snapshot.val();

        var url = img.cloudinary_url;
        if(url == null || url == ''){
            console.log('cloudinary url not available');
            url = img.url;
        }

        add(img.team, url, img.msg);
    });
}

function loadAll(){
    ref.child('pitscout/images').on('child_added', function(snapshot) {
      var img = snapshot.val();

      var url = img.cloudinary_url;
      if(url == null || url == ''){
          console.log('cloudinary url not available');
          url = img.url;
      }

      add(img.team, url, img.msg);
    });
}

function add(team, url, msg){

    var container = $('#pitmedia');

    var html =
    '<div class ="mediaItem"><img src="' + url + '" width="450px"/>' +
    '<h4 class="teamcaption">Team ' + team + '</h4><h4 class="caption">' + msg + '</h4></div>'

    container.append(html);
}


$(document).ready(function() {
    var team = getUrlParameter('team');
    if(team == null || team == ''){
        loadAll();
    }else {
        loadTeam(parseInt(team));
    }
});

function getUrlParameter(sParam)
{
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++)
    {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam)
        {
            return sParameterName[1];
        }
    }
    return '';
}
