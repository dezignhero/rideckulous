var Deck = function(selector, options) {

	/*------- Globals -------*/

	var initialized = false,
		viewportWidth = 0,
		animating = false,
		numCards = 0,
		goTo = 0,
		currentCard = 0,
		lastSlide = 0,
		progression = 0,
		orientation = 0,
		stash = [];

	// Card Handles
	var $cc = $lc = $nc = [];

	// Swiping
	var swipe = {
		started : false,
		startX : 0,
		endX : 0,
		strength : 0
	};

	// settings: Can be overwrote by options parameters
	var settings = {
		cards : '.page',
		controls : '.control',
		zIndex : 10,
		ease : 0.25,
		shrink : 0.95,
		sensitivity : 4,
		swipeMin : 40,
		backgroundColor : '#CCCCCC',
		overlayOpacity : 0.5,
		fullWidth : true,
		hash : 'page'
	};

	/*------- Initialization -------*/
	
	var el = selector,
		$parent = $(el),
		$cards, $controls, $overlay, $background;
	
	/*------- Methods -------*/

	var init = function(options) {
		// Options
		settings = $.extend(settings, options || {});

		// Initialize values
		settings.transition = 'all '+settings.ease+'s ease-out';
		$cards = $(settings.cards, el);
		$controls = $(settings.controls);

		// Assign Ids to the cards
		numCards = $cards.length;
		$cards.each(function(i){
			var self = $(this);

			self.attr('data-id', i);
			
			// Add initial class
			if ( i == 0 ) {
				$cc = self;
				$cc.slot('current', false);
			} else if ( i == 1 ) {
				$nc = self;
				$nc.slot('next', false);
			}
		}).css({ '-webkit-transform-style':'preserve-3d' });

		// Inject overlay and backing
		var cardTag = $cards.prop('tagName');
		$overlay = $(document.createElement(cardTag)).attr({
			'class' : 'overlay',
			'style' : 'position:absolute;width:100%;height:100%;-webkit-transform-style:preserve-3d;z-index:'+(settings.zIndex+6)+';background:rgba(0,0,0,'+settings.overlayOpacity+');'
		}).appendTo(el);
		$background = $(document.createElement(cardTag)).attr({
			'class' : 'backing',
			'style' : 'position:absolute;width:100%;height:100%;z-index:'+settings.zIndex+';background:'+settings.backgroundColor+';'
		}).appendTo(el);

		// Set Dimensions
		resize();

		// Display controls correctly
		updateControls();

		// Monitoring controls if they exist
		if ( $controls.length > 0 ) {
			// Determine whether or not to use click event
			settings.clickEvent = ('ontouchstart' in document.documentElement) ? 'touchstart' : 'click';

			$controls.on(settings.clickEvent, function(){
				var self = $(this),
					action = self.attr('data-action');

				// Ensure action defined
				if ( typeof action != 'undefined' ) return;

				if ( action == 'next' && currentCard < numCards - 1 ) {
					goTo = currentCard + 1;
				} else if ( action == 'prev' && currentCard > 0 ) {
					goTo = currentCard - 1;
				}

				// Move container
				jumpTo(goTo);
			});
		}

		// Swiping
		$parent[0].addEventListener('touchstart', function(e) { touchStart(e); }, false);
		$parent[0].addEventListener('touchmove', function(e) { touchMove(e); }, false);
		$parent[0].addEventListener('touchend', function(e) { touchEnd(e); }, false);
		// Desktop
		$parent[0].addEventListener('mousedown', function(e) { touchStart(e); }, false);
		$parent[0].addEventListener('mousemove', function(e) { if ( e.which==1 ) { touchMove(e); } }, false);
		$parent[0].addEventListener('mouseup', function(e) { touchEnd(e); }, false);

		// Prevent anchor tags from getting in the way
		$('a', el).on('touchstart click', function(){
			return swipe.started ? false : true;
		});

		// Prevent image dragging on getting in the way
		$('img', el).on('dragstart', function(){
			return false;
		});

		// Add this because back button doesn't work on Safari
		window.addEventListener('hashchange', function() {
			jumpToHash();
		});

		// Check if Android
		var ua = navigator.userAgent.toLowerCase(),
			isAndroid = ua.indexOf("android") > -1;

		// Orientation Change
		var supportsOrientationChange = "onorientationchange" in window,
			orientationEvent = (supportsOrientationChange && !isAndroid) ? "orientationchange" : "resize";

		// Listener for orientation changes
		orientation = window.orientation;
		window.addEventListener(orientationEvent, function(){
			// Prevent 'fake' orientation calls
			if ( orientation != window.orientation ) {
				orientation = window.orientation;
				resize(function(){
					jumpTo(currentCard);
				});
			}
		}, false);

		// Set initialized flag
		initalized = true;

		// Execute saved callbacks
		for ( var i=0, e=stash.length; i<e; i++ ) {
			var cb = stash.pop();
			cb();
		}

		// Jump To Hash
		jumpToHash();
	},

	ready = function(callback) {
		if ( initialized == true ) { 
			callback();
		} else {
			stash.push(callback);
		}
	},

	resize = function(callback){
		viewportWidth = $parent.width();

		if ( settings.fullWidth ) {
			// Apply new width
			$cards.width(viewportWidth);
		}

		// callback
		if ( typeof callback == 'function' ) {
			callback();
		}
	},

	touchStart = function(e) {
		// Get start point
		swipe.startX = e.touches ? e.touches[0].pageX : e.pageX;
		swipe.startY = e.touches ? e.touches[0].pageY : e.pageY;
		swipe.endX = swipe.startX;  // prevent click swiping when touchMove doesn't fire

		// Initiate card references
		assignCards();
	},
	
	touchMove = function(e) {
		swipe.started = true;
		
		var touchX = e.touches ? e.touches[0].pageX : e.pageX,
			touchY = e.touches ? e.touches[0].pageY : e.pageY,
			dX = touchX - swipe.startX,
			dY = touchY - swipe.startY;
		
		swipe.strength = Math.abs(touchX - swipe.endX);
		swipe.endX = touchX;
		
		// Escape if motion wrong
		if ( Math.abs(dX) < Math.abs(dY) ) return true;

		// Prevent default event and page bounce
		e.preventDefault();
		
		animate(dX);
	},

	touchEnd = function(e) {
		swipe.started = false;

		if ( animating ) return;

		// Nullify event
		e.preventDefault();

		var moved = swipe.endX - swipe.startX,
			threshold = viewportWidth / settings.sensitivity;

		goTo = currentCard;

		// Figure out closest slide
		if ( Math.abs(moved) > threshold || swipe.strength > settings.swipeMin ) {
			if ( moved > 0 && currentCard > 0 ) {
				goTo--;
			} else if ( moved < 0 && currentCard < numCards-1 ) {
				goTo++;
			}
		}

		// Jump to closest
		jumpTo(goTo);
	},
	
	animate = function(dX) {
		progression = (dX / viewportWidth / 20).toFixed(4);
		
		// Choose which way to animate
		if ( dX <= 0 ) {  // Going to the left
			// lock other card in place
			$lc.transform('translate3d('+-viewportWidth+'px,0,0)', false);
			// animate actual card
			$cc.transform('translate3d('+dX+'px,0,0)', false);
			// scale next card
			$nc.transform('scale('+(settings.shrink-progression)+')', false);
			// overlay adjustment
			$overlay.css({
				'opacity' : settings.overlayOpacity * (1 + dX/viewportWidth),
				'z-index' : settings.zIndex+6,
				'-webkit-transition' : ''
			});
		} else {
			// lock other card in place
			$cc.transform('translate3d(0,0,0) scale('+(1-progression)+')', false);
			// animate actual card
			$lc.transform('translate3d('+(dX-viewportWidth)+'px,0,0)', false);
			// overlay adjustment
			$overlay.css({
				'opacity' : Math.min(settings.overlayOpacity, settings.overlayOpacity * dX/viewportWidth + 0.1),
				'z-index' : settings.zIndex+8,
				'-webkit-transition' : ''
			});
		}
	},

	assignCards = function() {
		$cards.hide();
		$cc = $($cards.selector+'.current').show();
		$lc = $($cards.selector+'.last').show();
		$nc = $($cards.selector+'.next').show();
	},

	jumpTo = function(num) {
		// Keep within range
		num = parseInt(num);
		if ( num >= 0 && num < numCards ) {

			// How far away is the new card?
			var diff = Math.abs( num - currentCard );

			// Reassign card references
			assignCards();

			// Determine how to move slides
			if ( diff == 0 ) {
				$cc.slot('current', true);
				$lc.slot('last', true);
				$nc.slot('next', true);
			} else {
				var $go = $(settings.cards+'[data-id='+num+']'),
					$before = $(settings.cards+'[data-id='+(num-1)+']'),
					$after = $(settings.cards+'[data-id='+(num+1)+']');

				// Are we REALLY jumping?
				if ( diff >= 2 ) {  // Yes
					// Determine where to start from
					var startPos = ( num > currentCard ) ? 'next' : 'last';

					// Need to animate $cc reveal if card is below
					if ( num > currentCard ) {
						$cc.slot('last', true);
					}

					// Shuffle cards into correct positions
					$go.show().slot(startPos, false, function(){
						$go.slot('current', true, function(){
							$before.slot('last', false);
							$after.slot('next', false);
							
							// Update current slide
							currentCard = num;
						});
					});
				} else {  // Locking in place
					$go.slot('current', true);

					// Going to card is below current card
					if ( num > currentCard ) {
						$after.slot('next', true);
						$before.slot('last', true);
					} else {
						$before.slot('last', true);
						$after.slot('next', true);
					}

					// Update current slide
					currentCard = num;
				}

				// Update parent to trigger update event and pass data
				$parent.trigger('update', [ parseInt(num)+1, numCards ]);
			}

			// Reset overlay z-index
			$overlay.css({
				'-webkit-transition' : settings.transition,
				'opacity' : settings.overlayOpacity,
				'z-index' : settings.zIndex+6
			});
			
			// Update window location hash
			window.location.hash = settings.hash+'='+(parseInt(num)+1);
			
			// Control Buttons
			updateControls();
		}
	},

	jumpToHash = function() {
		// Update window location hash
		var hashes = document.location.hash.split('='),
			bookmark = ( hashes == '' ) ? 0 : ~~(hashes[1])-1;

		if(bookmark !== currentCard) {
			jumpTo(bookmark);
		}
	},

	updateControls = function() {
		if ( $controls.length == 0 ) return;

		var $prevCtrl = $(settings.controls+'[data-action=prev]'),
			$nextCtrl = $(settings.controls+'[data-action=next]');

		if ( currentCard >= 0 && currentCard < numCards ) {
			$controls.show();
			if ( currentCard == 0 ) {
				$prevCtrl.hide();
			} else if ( currentCard == numCards-1 ) {
				$nextCtrl.hide();
			}	
		} else {
			$controls.hide();
		}
	};

	$.fn.transform = function(transform, ease, callback) {
		var self = $(this);
		// Check if card exists
		if ( self.length == 0 ) return false;

		// Momentum Effect or Not
		self.css({ 
			'-webkit-transform' : transform,
			'-webkit-transition' : ( ease ) ? settings.transition : ''
		});

		// Allow animating again
		if ( typeof callback == 'function' ) {
			animating = true;
			var delay = ( ease ) ? settings.ease*1000 : 0;
			window.setTimeout(function(){
				animating = false;
				callback();
			}, delay);
		}
	};

	$.fn.slot = function(pos, ease, callback) {
		var self = $(this),
			transform = '',
			zIndex = settings.zIndex;

		// Requires valid jQuery object
		if ( self.length == 0 ) return;

		// Slot in correct position and scale
		if ( pos == 'current' ) {
			transform = 'translate3d(0,0,0) scale(1)';
			zIndex += 7;
		} else if ( pos == 'last' ) {
			transform = 'translate3d('+-viewportWidth+'px,0,0) scale(1)';
			zIndex += 10;
		} else if ( pos == 'next' ) {
			transform = 'translate3d(0,0,0) scale('+settings.shrink+')';
			zIndex += 1;
		}

		// Prevent duplicates
		$(settings.cards+'.'+pos).unslot(pos, false);

		self.removeClass('current last next')
			.addClass(pos)
			.css('z-index', zIndex)
			.transform(transform, ease, callback);

	};

	$.fn.unslot = function(pos, ease) {
		var self = $(this),
			transform = '';

		// Requires valid jQuery object
		if ( self.length == 0 ) return;

		self.removeClass(pos).css({
			'z-index' : settings.zIndex,
			'-webkit-transform' : 'translate3d(0,0,0) scale('+settings.shrink+')',
			'-webkit-transition' : ( ease ) ? settings.transition : ''
		});
	};

	return {

		initialize : function() {
			init(options);
		},

		ready : function(cb) {
			ready(cb);
		},

		element : $parent,

		jumpTo : jumpTo,

		resize : resize,

		status : function() {
			return {
				'current' : currentCard+1,
				'total' : numCards
			}
		},

		next : function() {
			jumpTo(currentCard+1);
		},

		prev : function() {
			jumpTo(currentCard-1);  
		}
	};

}