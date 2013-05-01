var Deck = function(selector, options) {

	/*------- Globals -------*/

	var viewportWidth = 0,
		animating = false,
		numSlides = 0,
		goTo = 0,
		currentCard = 0,
		lastSlide = 0;

	// Swiping
	var swipe = {
		started : false,
		startX : 0,
		endX : 0
	};

	// Defaults
	var defaults = {
		easeDefault : 0.2
	};

	/*------- Initialization -------*/
	
	var el = selector,
		$parent = $(el),
		$cards = $('.page', el),
		$controls = $('.control');
	
	/*------- Methods -------*/

	var init = function(options) {
		// Options
		defaults = $.extend(defaults, options || {});

		// Setup
		$cards.css({ '-webkit-transition' : 'all '+defaults.easeDefault+'s ease-out' });

		// Assign ids
		numSlides = $cards.length;
		$cards.each(function(i){
			var self = $(this);
			self.attr('data-id', i);
			// self.css({ 'z-index' : numSlides-i });
			// Add initial class
			if ( i == 0 ) self.addClass('current');
			if ( i == 1 ) self.addClass('next');
		});

		// Set Dimensions
		resize();

		// Display controls correctly
		updateControls();

		// Behavior
		$controls.on('touchstart, click', function(){
			if ( !animating ) {
				animating = true;

				var self = $(this);
				if ( self.hasClass('next') && currentCard < numSlides-1 ) {
					goTo = currentCard + 1;
				} else if ( self.hasClass('prev') && currentCard > 0 ) {
					goTo = currentCard - 1;
				}

				// Move container
				jumpTo(goTo);
			}
		});

		// Swiping
		$parent[0].addEventListener('touchstart', function(e) { touchStart(e); }, false);
		$parent[0].addEventListener('touchmove', function(e) { touchMove(e); }, false);
		$parent[0].addEventListener('touchend', function(e) { touchEnd(e); }, false);
		// Desktop
		$parent[0].addEventListener('mousedown', function(e) { touchStart(e); }, false);
		$parent[0].addEventListener('mousemove', function(e) { if ( e.which==1) { touchMove(e); } }, false);
		$parent[0].addEventListener('mouseup', function(e) { touchEnd(e); }, false);

		// Orientation Change
		var supportsOrientationChange = "onorientationchange" in window,
			orientationEvent = supportsOrientationChange ? "orientationchange" : "resize";

		window.addEventListener(orientationEvent, function() {
			resize(function(){
				jumpTo(currentCard);
			});
		}, false);
	},

	resize = function(callback){
		viewportWidth = $parent.width();

		// callback
		if ( typeof callback != 'undefined') {
			callback();
		}
	},

	touchStart = function(e) {
		swipe.started = true;
		// Get start point
		swipe.startX = e.touches ? e.touches[0].pageX : e.pageX;
		swipe.startY = e.touches ? e.touches[0].pageY : e.pageY;
		swipe.endX = swipe.startX;  // prevent click swiping when touchMove doesn't fire
	},
	
	touchMove = function(e) {
		if ( swipe.started ) {
			var touchX = e.touches ? e.touches[0].pageX : e.pageX,
				touchY = e.touches ? e.touches[0].pageY : e.pageY,
				dX = touchX - swipe.startX,
				dY = touchY - swipe.startY;
			
			swipe.endX = touchX;
			
			// Escape if motion wrong
			if ( Math.abs(dX) < Math.abs(dY) ) return true;

			// Prevent default event
			e.preventDefault();

			// Always run this so that hit the ends
			var $cc = $('.page.current'),
				$lc = $('.page.last');
			
			if ( dX <= 0 ) {
				animate($cc, dX, 'none');
				animate($lc, -viewportWidth, 'none');  // lock other card in place
			} else {
				animate($lc, dX-viewportWidth, 'none');
				animate($cc, 0, 'none');
			}
		}
	},

	touchEnd = function(e) {
		swipe.started = false;

		// Nullify event
		e.preventDefault();

		if ( !animating ) {
			var moved = swipe.endX - swipe.startX,
				threshold = viewportWidth/4;

			// Figure out closest slide
			if ( moved > threshold && currentCard > 0 ) {
				goTo = currentCard - 1;
			} else if ( moved < -threshold && currentCard < numSlides-1 ) {
				goTo = currentCard + 1;
			} else {
				goTo = currentCard;
			}

			// Jump to closest
			jumpTo(goTo, 0.15);
		}
	},
	
	animate = function($card, scrollTo, ease, callback) {
		// Check if card exists
		if ( $card.length == 0 ) return false;

		// Momentum Effect or Not
		var transition = ( ease != 'none' ) ? 'all '+ease+'s ease-out' : 'none';

		$card[0].style.webkitTransition = transition;
		$card[0].style.webkitTransform = 'translate3d('+scrollTo+'px,0,0)';

		// Allow animating again
		if ( ease != 'none' ) {
			window.setTimeout(function(){
				animating = false;
				if ( typeof callback != 'undefined' ) {
					callback();
				}
			}, ease*1000);
		}
	},

	jumpTo = function(num, ease) {
		// Keep within range
		if ( num >= 0 && num < numSlides ) {

			// Animate
			var easeAmt = ease || defaults.easeDefault;
			animating = true;

			// Determine how to move slides
			var $cc = $($cards.selector+'[data-id='+currentCard+']');
			var $lc = $($cards.selector+'.last');

			if ( num == currentCard ) {
				animate($cc, 0, easeAmt);
				animate($lc, -viewportWidth, easeAmt);
			} else {
				var $nc = $($cards.selector+'[data-id='+num+']');
				
				if ( num > currentCard ) {
					animate($cc, -viewportWidth, easeAmt, function(){
						$cards.removeClass('last current next');
						$cc.addClass('last');
						$nc.addClass('current');
						$($cards.selector+'[data-id='+(num+1)+']').addClass('next');
					});
				} else if ( num < currentCard ) {
					$nc.addClass('last');
					animate($nc, 0, easeAmt, function(){
						$cards.removeClass('last current next');
						$nc.addClass('current');
						$($cards.selector+'[data-id='+(num-1)+']').addClass('last');
						$($cards.selector+'[data-id='+(num+1)+']').addClass('next');
					});
				} 





				// // Reset classes
				// $cards.removeClass('current last next');

				// // How to move slides in
				// if ( num > currentCard ) {  // below current card
				// 	console.log('next');
				// 	$nc.addClass('next');
				// 	animate($cc, -viewportWidth, easeAmt);

				// 	$nc.removeClass('next').addClass('current');
				// 	$cc.addClass('last');
				// } else {  // above current card
				// 	console.log('last');
				// 	animate($nc, -viewportWidth, 'none');
				// 	animate($nc, 0, easeAmt);
					
				// 	$nc.addClass('current');
				// 	$cc.addClass('next');
				// }




				// Update current slide
				currentCard = num;
			}

			// Control Buttons
			updateControls();
		}
	},

	updateControls = function() {
		// Enable control buttons
		if ( currentCard > 0 && currentCard < numSlides-1 ) {
			$('.control', el).show();
		} else if ( currentCard <= 0 ) {
			$('.control.prev').hide();
			if ( !defaults.preventAdvance || currentCard==0 ) {
				$('.control.next').show();
			}
		} else if ( currentCard >= numSlides-1 ) {
			$('.control.next').hide();
			$('.control.prev').show();
		}
	};

	// Initialize the object
	init(options);

	return {

		element : $parent,

		width : viewportWidth,

		jumpTo : jumpTo,

		current : function() {
			return currentCard+1;
		},

		total : numSlides,

		next : function() {
			jumpTo(currentCard+1);
		},

		prev : function() {
			jumpTo(currentCard-1);  
		}
	};

}