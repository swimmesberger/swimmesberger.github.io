/// <reference path="vendor/prototype.js" />
/// <reference path="vendor/jquery-1.10.1.min.js" />
Object.size = function (obj) {
  var size = 0, key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) size++;
  }
  return size;
};

String.prototype.toHHMMSS = function () {
  var sec_num = parseInt(this, 10); // don't forget the second parm
  var hours = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  var seconds = sec_num - (hours * 3600) - (minutes * 60);

  if (hours < 10) { hours = "0" + hours; }
  if (minutes < 10) { minutes = "0" + minutes; }
  if (seconds < 10) { seconds = "0" + seconds; }
  var time = hours + ':' + minutes + ':' + seconds;
  return time;
};

(function () {
  var YoutubeSplitter = Class.create();
  YoutubeSplitter.prototype = {
    initialize: function (players, ytControl) {
      this.loadedPlayer = {};
      this.loadingPlayers = {};
      this.firstInit = true;
      this.unmutedPlayer = undefined;
      this.currentState = -1;
      this.playAllCb = [];
      this.playingVideos = {};
      this.first = true;
      
      this.ytControl = ytControl;
      this.players = players;
      window.StateEvents = null;
      window.onYouTubePlayerReady = null;
      var that = this;
      window.onYouTubePlayerReady = function (playerId) {
        try {
          var $player = jQuery("#" + playerId);
          var player = $player[0];
          that.loadedPlayer[playerId] = player;
          var stateChange = function (newState) {
            that.onPlayerStateChange(newState, playerId);
          };
          var stateEvents = window.StateEvents;
          if (stateEvents == null) {
            stateEvents = {};
          }
          var savePlayerId = playerId.replace(/[0-9$-]/g, '');
          stateEvents[savePlayerId] = stateChange;
          window.StateEvents = stateEvents;
          var eventName = 'StateEvents.' + savePlayerId;
          player.addEventListener("onStateChange", eventName);
          that.onPlayerLoaded(player);
          var loadedCount = Object.size(that.loadedPlayer);
          if (loadedCount >= that.players.length) {
            that.initVideos();
          }
          that.loadMetadata(playerId);
        } catch (e) {
          console.error(e.message);
        }
      };
    },
    loadMetadata: function(playerId) {
      jQuery.getJSON("https://gdata.youtube.com/feeds/api/videos/" + playerId + "?v=2&alt=json", function (json) {
        var videoUrl = jQuery('<a target="_blank"></a>');
        var channelName = json.entry.author[0].name.$t;
        videoUrl.html(channelName);
        videoUrl.attr("href", "http://www.youtube.com/watch?v=" + playerId);
        var videoTitle = jQuery("#" + playerId).parent().find(".yt-title");
        videoTitle.append(videoUrl);
      });
    },
    showLoader: function(playerId) {
      var $player = jQuery("#" + playerId);
      $player.parent().spin('large', '#fff');
    },
    hideLoader: function(playerId) {
      var $player = jQuery("#" + playerId);
      $player.parent().spin(false);
    },
    onPlayerStateChange: function (newState, playerId) {
      console.log("State: " + newState + " vid: " + playerId);
      if (newState === 3) {
        this.loadingPlayers[playerId] = true;
        delete this.playingVideos[playerId];
        this.pauseAll(this.getPlayer(playerId));
        this.showLoader(playerId);
      }
      if (newState == 1) {
        if (this.loadingPlayers[playerId]) {
          delete this.loadingPlayers[playerId];
          this.hideLoader(playerId);
        }
        var player = this.getPlayer(playerId);
        this.playingVideos[playerId] = player;
        var loadedCount = Object.size(this.playingVideos);
        var that = this;
        if (loadedCount >= this.players.length) {
          if (this.first) {
            this.first = false;
            this.onAllFinished();
          } else {
            this.playAll();
          }
          if (this.playAllCb.length > 0) {
            jQuery.each(this.playAllCb, function (key, val) {
              delete that.playAllCb[key];
              val.call();
            });
          }
        } else {
          player.pauseVideo();
        }
      }
      if (newState == -1) {
        var player = this.getPlayer(playerId);
        this.onVideoLoaded(player);
      }
    },
    all: function(fnc){
      var player = this.getPlayers();
      jQuery.each(player, function (key, val) {
        fnc(val);
      });
    },
    initVideos: function () {
      if (this.firstInit) {
        this.firstInit = false;
        this.muteAll();
        var player = this.getPlayer();
        player.unMute();
        this.unmutedPlayer = player;
        var that = this;
        this.playAll(function () {
          that.pauseAll();
        });
      }
    },
    syncStart: function () {
      this.initVideos();
      var that = this;
      setTimeout(function () {
        that.playAll();
      });
    },
    setQuality: function (qualityTag) {
      this.all(function (val) {
        val.setPlaybackQuality(qualityTag);
      });
    },
    muteAll: function(){
      this.all(function (val) {
        val.mute();
      });
    },
    unMuteAll: function(){
      this.all(function (val) {
        val.unMute();
      });
    },
    toggleMute: function () {
      var unmutedPlayer = this.unmutedPlayer;
      if (unmutedPlayer.isMuted()) {
        unmutedPlayer.unMute();
      } else {
        unmutedPlayer.mute();
      }
      this.onVolumeChanged(this.getVolume());
    },
    setVolume: function(value){
      this.unmutedPlayer.setVolume(value);
      this.onVolumeChanged(this.getVolume());
    },
    getVolume: function () {
      if (this.unmutedPlayer == null) {
        return -1;
      }
      return this.unmutedPlayer.getVolume();
    },
    togglePlay: function(){
      if (this.currentState == 1) {
        this.pauseAll();
      } else {
        this.playAll();
      }
    },
    playAll: function (func) {
      if (this.firstInit) {
        this.syncStart();
        return;
      } else {
        if (func) {
          this.playAllCb.push(func);
        }
        this.all(function (val) {
          val.playVideo();
        });
      }
      this.currentState = 1;
      this.ytControl.play();
    },
    pauseAll: function(player){
      this.all(function (val) {
        if (!player || val != player) {
          val.pauseVideo();
        }
      });
      this.currentState = 2;
      this.ytControl.pause();
    },
    isPaused: function() {
      return this.currentState == 2;
    },
    seekTo: function (seconds) {
      if (seconds <= 0) return;
      var wasPaused = this.isPaused();
      this.pauseAll();
      var ahead = true;
      this.all(function (val) {
        var duration = val.getDuration();
        if (seconds >= duration) {
          seconds = duration-1;
        }
        val.seekTo(seconds, ahead);
      });
      this.pauseAll();
      var that = this;
      if (wasPaused == false) {
        setTimeout(function() {
          that.playAll();
        }, 1000);
      }
    },
    getPlayers: function(){
      var arr = [];
      jQuery.each(this.loadedPlayer, function (key, val) {
        arr.push(val);
      });
      return arr;
    },
    getPlayer: function (id) {
      if (id == null) {
        for (var prop in this.loadedPlayer) {
          return this.loadedPlayer[prop];
        }
      }
      return this.loadedPlayer[id];
    },
    generatePlayers: function () {
      var youtubeIds = this.players;
      var $playerContainer = jQuery('#ytapiplayer');
      $playerContainer.empty();
      var videoCount = youtubeIds.length;
      var rows = 1;
      var columns = 1;
      if (videoCount >= 2) {
        var sqrt = Math.sqrt(videoCount);
        var rounded = Math.round(sqrt);
        var columns = rounded;
        if (sqrt > rounded) {
          columns++;
        }
        rows = rounded;
      }
      var that = this;
      jQuery.each(youtubeIds, function (key, val) {
        var $outerContainer = jQuery('<div class="youtube-item"></div>');
        var $ytContainer = jQuery("<div></div>").attr('id', val);
        var $ytVideoOverlay = jQuery('<div class="youtube-item-overlay"><h2 class="yt-title"></h2></div>');
        $ytVideoOverlay.click(function () {
          var vid = jQuery(this).prev()[0];
          return that.onClick(vid);
        })
        $outerContainer.append($ytContainer);
        $outerContainer.append($ytVideoOverlay);
        $playerContainer.append($outerContainer);
        var width = 100 / columns;
        var height = 100 / rows;
        var children =  $playerContainer.children().length;
        var actRow = Math.floor(children / columns);
        var actColumn = 0;
        var mod = children % columns;
        if (mod > 0) {
          actRow++;
          actColumn = mod - 1;
        } else {
          actColumn = columns-1;
        }
        actRow = actRow - 1;
        var topOffset =  height * actRow;
        var leftOffset = width * actColumn;
        $outerContainer.css("width", width + "%");
        $outerContainer.css("height", height + "%");
        // workaround - need to work with position absolute here because I need position aboslute later for fullscreening a single video
        // changing of position on a flash embed reloads the entire video -> we don't want that
        $outerContainer.css("position", "absolute");
        $outerContainer.css("top", topOffset + "%");
        $outerContainer.css("left", leftOffset + "%");
        // workaround
        $outerContainer.data("oldWidth", width);
        $outerContainer.data("oldHeight", height);
        $outerContainer.data("oldLOff", leftOffset);
        $outerContainer.data("oldTOff", topOffset);
        that.loadPlayer($ytContainer, val, "100%", "100%");
      });
    },
    loadPlayer: function (container, youtubeId, height, width) {
      var id = container.attr('id');
      var params = { allowScriptAccess: "always" , "wmode": "opaque"};
      var atts = { id: id };
      var videoUrl = "http://www.youtube.com/apiplayer?video_id=" + youtubeId + "&enablejsapi=1&playerapiid=" + id + "&version=3";
      swfobject.embedSWF(videoUrl, id, width, height, "8", null, null, params, atts);
    },
    hidePlayer: function (player) {
      jQuery(player).parent().css({ position: "absolute", left: "0px", top: "0px" });
    },
    showPlayer: function (player) {
      var $outerContainer = jQuery(player).parent();
      var leftOffset = $outerContainer.data("oldLOff");
      var topOffset = $outerContainer.data("oldTOff");
      $outerContainer.css({ position: "absolute", left: leftOffset + "%", top: topOffset + "%" });
    },
    toggleFullscreen: function (video) {
      var $vidCont = jQuery(video).parent();
      var isFull = $vidCont.data('full');
      if (isFull == null) {
        isFull = false;
      }
      if (!isFull) {
        this.fullscreen(video);
        $vidCont.data('full', true);
      } else {
        this.exitFullscreen(video);
        $vidCont.data('full', false);
      }
    },
    fullscreen: function(video){
      var $vidCont = jQuery(video).parent();
      var player = this.getPlayers();
      var that = this;
      jQuery.each(player, function (key, val) {
        if (val != video) {
          that.hidePlayer(val);
        }
      });
      $vidCont.show();
      $vidCont.css("z-index", 1);
      $vidCont.css("top", "0px");
      $vidCont.css("left", "0px");
      $vidCont.css("width", "100%");
      $vidCont.css("height", "100%");
    },
    exitFullscreen: function (video) {
      var $vidCont = jQuery(video).parent();
      var player = this.getPlayers();
      var that = this;
      jQuery.each(player, function (key, val) {
        jQuery(val).parent().show();
        that.showPlayer(val);
      });
      $vidCont.css("z-index", 0);
      $vidCont.css("width", $vidCont.data('oldWidth') + "%");
      $vidCont.css("height", $vidCont.data('oldHeight') + "%");
    },
    onVideoLoaded: function(player){ },
    onPlayerLoaded: function(player){ },
    onAllFinished: function () {
      console.log("Everything started");
      var maxDur = 0;
      var that = this;
      var updateTime = function () {
        var player = that.getPlayer();
        if (!player.getCurrentTime) {
          return;
        }
        var currTime = player.getCurrentTime();
        that.ytControl.setCurrentTime(currTime);
        setTimeout(updateTime, 1000);
      };
      var updateLoading = function () {
        var players = that.getPlayers();
        var min = 2;
        var flagErr = false;
        jQuery.each(players, function (key, val) {
          if (!val.getVideoLoadedFraction) {
            flagErr = true;
            return false;
          }
          var loaded = val.getVideoLoadedFraction();
          if (loaded < min) {
            min = loaded;
          }
        });
        if (flagErr) {
          return;
        }
        that.ytControl.setLoadedFraction(min);
        setTimeout(updateLoading, 2000);
      };
      jQuery.each(this.getPlayers(), function (key, val) {
        var dur = val.getDuration();
        if (dur > maxDur) {
          maxDur = dur;
        }
      });
      that.ytControl.setDuration(maxDur);
      updateTime();
      updateLoading();
    },
    onVolumeChanged: function () {

    },
    onClick: function (video) {
      return false;
    }
  };
  window.YoutubeSplitter = YoutubeSplitter;

  var YoutubeControl = Class.create();
  YoutubeControl.prototype = {
    initialize: function () {
      this.leftVolumeMax = 46;
      this.isFullScreen = false;
      this.isSeeking = false;
      this.currentTime = 0;
      this.duration = 0;
      this.loadedFrac = 0;
      this.hideControlsTimeout = undefined;
      this.hideControlsTime = 5000;
    },
    initControls: function (splitter) {
      var that = this;
      
      jQuery(".ytp-button[tabindex=3]").unbind('click').click(function () {
        splitter.togglePlay();
      });
      var mouseDown = false;
      var skala = jQuery(".html5-volume-slider").width();
      var resetSlide = function () {
        if (mouseDown) {
          mouseDown = false;
          return false;
        }
      };
      var calcRelLeft = function (e) {
        var parentOffset = jQuery(this).parent().offset();
        //or $(this).offset(); if you really just want the current element's offset
        var relX = e.pageX - parentOffset.left;
        if (relX > that.leftVolumeMax) {
          relX = that.leftVolumeMax;
        }
        if (relX < 0) {
          relX = 0;
        }
        return relX;
      };

      jQuery(".html5-volume-slider-foreground").unbind('draggable').draggable({
        containment: ".html5-volume-panel",
        axis: "x",
        drag: function (e) {
          var relX = calcRelLeft.call(this, e);
          that.volumeControlChanged(splitter, relX);
        }
      });

      var seekToTime = 0;
      jQuery(".html5-scrubber-button").unbind('draggable').draggable({
        containment: ".html5-progress-bar-inner",
        axis: "x",
        drag: function (e) {
          that.isSeeking = true;
          var parentOffset = jQuery(".html5-progress-bar-inner").offset();
          //or $(this).offset(); if you really just want the current element's offset
          var relX = e.pageX - parentOffset.left;
          var width = jQuery(".html5-progress-bar-inner").width();
          var onePercent = 100 / width;
          var percent = onePercent * relX;
          var time = that.duration * (percent/100);
          seekToTime = time;
        },
        stop: function () {
          that.isSeeking = false;
          splitter.seekTo(seekToTime);
        }
      });

      jQuery(".html5-progress-bar-inner").unbind('click').click(function (e) {
        var parentOffset = jQuery(".html5-progress-bar-inner").offset();
        //or $(this).offset(); if you really just want the current element's offset
        var relX = e.pageX - parentOffset.left;
        var width = jQuery(".html5-progress-bar-inner").width();
        var onePercent = 100 / width;
        var percent = onePercent * relX;
        var time = that.duration * (percent/100);
        splitter.seekTo(time);
      });

      jQuery(".html5-volume-slider").unbind('click').click(function (e) {
        if (mouseDown) {
          resetSlide();
        }
        var relX = calcRelLeft.call(this, e);
        that.volumeControlChanged(splitter, relX);
        return false;
      });

      jQuery(".ytp-button-fullscreen-enter").unbind('click').click(function () {
        if (BigScreen.enabled) {
          if (that.isFullScreen === false) {
            BigScreen.request(jQuery(".html5-player")[0], function () {
              that.isFullScreen = true;
              jQuery(".html5-video-controls").css("position", "absolute");
              that.hideControlsNext();
            }, function () {
              that.isFullScreen = false;
              jQuery(".html5-video-controls").css("position", "relative");
              that.showControls();
            });
          } else {
            BigScreen.exit();
          }
        }
      });
      

      jQuery("#ytapiplayer").unbind('mousemove').mousemove(function () {
        that.showControls();
        that.hideControlsNext();
      }).mouseleave(function () {
        that.hideControlsNext();
      });

      jQuery(".ytp-settings-button").unbind('click').click(function () {
        var $menu = jQuery(".ytp-menu");
        if ($menu.is(":visible")) {
          $menu.hide();
        } else {
          $menu.show();
        }
      });

      jQuery(".html5-volume-button").unbind('click').click(function () {
        splitter.toggleMute();
        return false;
      });

      jQuery("#quality").unbind('change').change(function () {
        splitter.setQuality(jQuery(this).val());
      });
    },
    hideControlsNext: function () {
      var that = this;
      clearTimeout(that.hideControlsTimeout);
      that.hideControlsTimeout = setTimeout(function () {
        that.hideControls();
      }, that.hideControlsTime);
    },
    hideControls: function() {
      if (this.isFullScreen && this.isPaused() == false) {
        jQuery(".html5-video-controls").fadeOut();
      }
    },
    showControls: function() {
      jQuery(".html5-video-controls").fadeIn();
    },
    setDuration: function (duration) {
      this.duration = duration;
      jQuery(".ytp-time-duration").html((duration+"").toHHMMSS());
    },
    setCurrentTime: function (time) {
      this.currentTime = time;
      jQuery(".ytp-time-current").html((time + "").toHHMMSS());
      this.updateProgressbar();
    },
    setLoadedFraction: function(fraction){
      this.loadedFrac = fraction;
      jQuery('.html5-load-progress').css("-webkit-transform", "scaleX(" + fraction + ")");
    },
    getLoadedSeconds: function(){
      return this.duration * this.loadedFrac;
    },
    updateProgressbar: function(){
      var onePer = 100 / this.duration;
      var percent = onePer * this.currentTime;
      jQuery('.html5-play-progress').css("-webkit-transform", "scaleX(" + (percent / 100) + ")");
      if (this.isSeeking == false) {
        jQuery('.html5-scrubber-button').css("left", percent + "%");
      }
    },
    onVolumeChanged: function (volume) {
      if (volume < 0) { return };
      if (volume <= 0) {
        jQuery(".html5-volume-button").attr("data-value", "off");
      }else {
        jQuery(".html5-volume-button").attr("data-value", "loud");
      }
      jQuery(".html5-volume-button").attr("data-volume", volume);
      var that = this;
      var onePer = this.leftVolumeMax / 100;
      var lPos = Math.round(onePer * volume);
      jQuery(".html5-volume-slider-foreground").css('left', lPos);
    },
    volumeControlChanged: function (splitter, lPos) {
      var that = this;
      var calcVolume = function (leftPos) {
        leftPos = parseInt(leftPos, 10);
        if (leftPos == 1) {
          leftPos = 0;
        }
        var onePer = 100 / that.leftVolumeMax;
        return onePer * leftPos;
      };
      var volume = calcVolume(lPos);
      splitter.setVolume(volume);
    },
    play: function () {
      jQuery('.ytp-button-play').addClass("ytp-button-pause").removeClass("ytp-button-play");
      this.hideControlsNext();
    },
    pause: function () {
      jQuery('.ytp-button-pause').addClass("ytp-button-play").removeClass("ytp-button-pause");
      this.showControls();
    },
    isPaused: function() {
      var pauseBtn = jQuery('.ytp-button-pause');
      if (pauseBtn.length > 0) {
        return false;
      }
      return true;
    },
    togglePlay: function () {
      var pauseBtn = jQuery('.ytp-button-pause');
      if (pauseBtn.length > 0) {
        this.play();
      } else {
        this.pause();
      }
    }
  };
  window.YoutubeControl = YoutubeControl;
})();

jQuery.noConflict();
jQuery(function () {
  if (BrowserDetect.browser.toLowerCase().indexOf("chrome") > -1) {
    jQuery("#playerCSS").attr("href", "css/yt-player.css");
  } else {
    jQuery("#chromeWarn").show();
  }
  // Bind to StateChange Event
  History.Adapter.bind(window, 'statechange', function () { // Note: We are using statechange instead of popstate
    var State = History.getState(); // Note: We are using History.getState() instead of event.state
    if (State.data && !State.data.builder && State.data.length) {
      if (State.data.length > 0) {
        initPlayer(State.data);
      }
    } else {
      intBuilder();
    }
  });
  
  var urlvideos = jQuery.url(decodeURIComponent(window.location.href)).param("videos");
  //unsure history is updated and everything loaded (if videos are sent)
  if (urlvideos) {
    initUrl(urlvideos);
    initPlayer(urlvideos);
  } else {
    initUrl();
    intBuilder();
  }

  jQuery(".disabledForm").submit(function() {
    return false;
  });

  jQuery(".submit-videos").click(function() {
    var videoUrls = [];
    var error = false;
    jQuery(".url-input").each(function () {
      var url = jQuery(this).val();
      if (url.length <= 0) {
        return true;
      }
      var urlid;
      if (url.length == 11) {
        urlid = url;
      } else {
        urlid = youtube_parser(url);
        if (urlid == null) {
          jQuery(this).parent().addClass("has-error");
          error = true;
          return false;
        }
      }
      videoUrls.push(urlid);
    });
    if (error) {
      jQuery(".builder .alert").fadeIn();
      return;
    } else {
      jQuery(".builder .alert").fadeOut();
      jQuery(".builder .form-group").removeClass("has-error");
    }
    initUrl(videoUrls);
  });
  
  for (var i = 0; i < 4; i++) {
    addWatcherUrl();
  }

  jQuery("#addUrlBtn").click(function () {
    addWatcherUrl();
  });

  jQuery(".goBuild").click(function() {
    initUrl();
  });
  
  jQuery(".doStretch").click(function(){
	stretchVideo();
  });
  
  jQuery(".doPopOut").click(function(){
	popOut(jQuery(".youtube-item")[0]);
  });
  
  jQuery(document).keyup(function(e) {
	  if (e.keyCode == 27) { 
		if(paddingVideoBackup != null){
			unstretchVideo();
		}
	  }   // esc
  });
});

function addWatcherUrl() {
  var id = 1;
  var url = jQuery("#url" + id);
  var lastElm = url;
  while (url.length > 0) {
    id++;
    lastElm = url;
    url = jQuery("#url" + id);
  }
  
  var input = '<div class="input-group"><input type="text" class="url-input form-control" id="url' + id + '" placeholder="Enter video url"><span class="input-group-btn"></span></div>';
  var $newUrl = jQuery('<div class="form-group"><label for="url' + id + '">Video Url:</label>' + input + '</div>');
  
  var delBtn = jQuery('<button class="btn btn-danger" type="button"><span class="glyphicon glyphicon-minus"></span></button>').click(function () {
    $newUrl.closest('.form-group').remove();
  });

  $newUrl.find('.input-group-btn').append(delBtn);

  if (lastElm == null || lastElm.length <= 0) {
    jQuery(".builder form").prepend($newUrl);
  } else {
    lastElm.closest('.form-group').after($newUrl);
  }
};

function getWatcherUrlCount() {
  return jQuery(".url-input").length;
};

function initUrl(videos) {
  var str = window.location.pathname;
  var n = str.lastIndexOf('/');
  var result = str.substring(n + 1);
  if (videos == null || !videos.length || videos.length <= 0) {
    History.pushState({builder: true}, null, result);
    return;
  }

  History.pushState(videos, null, result + "?" + jQuery.param({ videos: videos }));
};

function initPlayer(videos) {
  jQuery(".builder").hide();
  jQuery(".playerPanel").show();
  var ytControl = new YoutubeControl();
  var splitter = new YoutubeSplitter(videos, ytControl);

  ytControl.initControls(splitter);
  splitter.onClick = function (vid) {
    splitter.toggleFullscreen(vid);
  };
  splitter.onVolumeChanged = function (vol) {
    if (vol < 0) { return; }
    ytControl.onVolumeChanged(vol);
  };
  splitter.generatePlayers();
  window.ActiveVidoes = videos;
};

function intBuilder() {
  jQuery(".playerPanel").hide();
  jQuery(".builder").show();
  if (window.ActiveVidoes) {
    var watcherCount = getWatcherUrlCount();
    while (watcherCount < window.ActiveVidoes.length) {
      addWatcherUrl();
      watcherCount++;
    }
    jQuery.each(window.ActiveVidoes, function(key, val) {
      jQuery("#url" + (key+1)).val(val);
    });
  }
};

function youtube_parser(url){
  var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
  var match = url.match(regExp);
  if (match&&match[7].length==11){
    return match[7];
  }else {
    return null;
  }
};

var paddingVideoBackup = null;
function stretchVideo(){
	paddingVideoBackup = jQuery(".html5-player").children('div.stretchy-wrapper').css('padding-bottom');
	jQuery(".html5-player").css({
		position: "absolute",
		top: "0px",
		left: "0px"
	});
	jQuery(".html5-player").children('div.stretchy-wrapper').css({
		paddingBottom: '0px',
		height: "99%"
	});
	jQuery(".html5-player").children('.html5-video-controls').css('position', 'absolute');
};

function unstretchVideo(){
	jQuery(".html5-player").css({
		position: "relative",
		top: null,
		left: null
	});
	jQuery(".html5-player").children('div.stretchy-wrapper').css({
		paddingBottom: "56.25%",
		height: null
	});
	jQuery(".html5-player").children('.html5-video-controls').css('position', 'relative');
	paddingVideoBackup = null;
};

function popOut(elm){
	var elm = jQuery(elm).clone();
	jQuery(elm).css({
		height: "100%",
		width: "100%"
	});
	var win = window.open("", "Title", "toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=yes");
	jQuery(win.document.head).append('<link id="playerCSS" href="css/yt-player_fx.css" rel="stylesheet" />');
	jQuery(win.document.head).append('<link rel="stylesheet" href="css/main.css">');
	win.document.body.innerHTML = jQuery(elm)[0].outerHTML;
};