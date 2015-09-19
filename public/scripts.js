var ref = new Firebase('https://teamdata.firebaseio.com/');

function loadTeam(team){
    ref.child('pitscout/images').orderByChild('team').equalTo(team).on('child_added', function(snapshot) {
        var img = snapshot.val();

        var url = img.cloudinary_url;
        if(url == null || url == ''){
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
          url = img.url;
      }

      add(img.team, url, img.msg);
    });
}

function add(team, url, msg){

    var container = $('#pitmedia');

    var html =
    '<div><a href="' + url + '"><img src="' + url + '" width=225 alt="thumbnail" /></a><h4>' +
        team + '</h4><p>' + msg + '</p></div>'
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
