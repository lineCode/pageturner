/*

  PageHammer
  
*/

var Emitter = require('emitter');
var $ = require('jquery');
var transform = require('transform-property');
var has3d = require('has-translate3d');

var template = require('./templates/booktemplate.js');

module.exports = PageTurner;

var options_defaults = {
  masksize:1,
  animtime:1500,
  perspective:800
}

function PageTurner(options){
  options = this.options = options || {};

  for(var prop in options_defaults){
    if(options[prop]===null || options[prop]===undefined){
      options[prop] = options_defaults[prop];
    }
  }

  if (!(this instanceof PageTurner)) return new PageTurner(options);

  var self = this;

  Emitter.call(this);

  this.options = options;

  this.page_html = [];
  this.currentpage = 0;

  this.book = $(this.options.bookselector);

  if(this.book.length<=0){
    throw new Error('pageturner cannot find the element for the book');
  }
}

/**
 * Inherit from `Emitter.prototype`.
 */

PageTurner.prototype = new Emitter;

PageTurner.prototype.render = function(){
  var self = this;
  var pages = this.book.find(this.options.pageselector);

  if(pages.length<=0){
    throw new Error('pageturner cannot find any pages for the book');
  }

  pages.each(function(i){
    self.page_html.push($(this).html());
  })

  this.book.html(template);

  this.base = this.book.find('#base');
  this.leaves = this.book.find('#leaves');

  setPerspective(this.leaves, this.options.perspective);

  this.book.bind('resize', function(){
    self.resize();
  });

  this.resize();
  this.load_page(this.options.startpage || 0);

  var resizingID = null;

  $(window).resize(function(){
    if(resizingID){
      clearTimeout(resizingID);
    }
    resizingID = setTimeout(function(){
      self.resize();
    }, 10)
    
  })
}

PageTurner.prototype.resize = function(){
  this.size = {
    width:this.book.width(),
    height:this.book.height()
  }

  this.base.width(this.size.width).height(this.size.height);
  this.leaves.width(this.size.width).height(this.size.height);
  this.book.find('.leaf, .leafholder').width(this.size.width).height(this.size.height);
}

/*

  gets the set index of page written into the GUI
  
*/
PageTurner.prototype.load_page = function(index){
  var self = this;
  
  self.emit('load', index);
  this.currentpage = index;

  this.baseleft = this.create_leaf('left', this.page_html[index-1]);
  this.baseright = this.create_leaf('right', this.page_html[index+1]);

  this.leafleft = this.create_double_leaf(this.page_html[index-1], this.page_html[index]);
  this.leafright = this.create_double_leaf(this.page_html[index], this.page_html[index+1]);
  
  var existingbase = this.base.find('> div');
  var existingleaves = this.leaves.find('> div');

  this.baseright.hide();
  this.baseleft.hide();
  this.leafright.hide();
  this.leafleft.hide();

  this.base.prepend(this.baseright).prepend(this.baseleft);
  this.leaves.prepend(this.leafright).prepend(this.leafleft);

  setRotation(this.leafright, 180);

  self.processmask(this.baseleft, 1);
  self.processmask(this.baseright, 1);

  this.leafleft.find('.leaf').each(function(){
    self.processmask($(this));
  })

  this.leafright.find('.leaf').each(function(){
    self.processmask($(this));
  })

  setTimeout(function(){
    existingbase.fadeOut(200, function(){
      existingbase.remove();
    });
    existingleaves.fadeOut(200, function(){
      existingleaves.remove();
    });
    
    self.leafright.show();
    self.leafleft.show();

    setTimeout(function(){
      self.active = true;
      self.emit('loaded', index);
    }, 200)
  }, 200);
}

PageTurner.prototype.processmask = function(leaf, val){
  var size = this.size;

  var usemask = arguments.length==2 ? val : 0;

  var rect = leaf.data('side') == 'left' ? 
    'rect(0px, ' + ((size.width/2)+usemask) + 'px, ' + (size.height) + 'px, 0px)' :
    'rect(0px, ' + (size.width) + 'px, ' + (size.height) + 'px, ' + ((size.width/2)-usemask) + 'px)'

  leaf.css({
    'clip':rect
  }) 
}

/*

  create an element that is one page of content masked either left or right
  
*/
PageTurner.prototype.create_leaf = function(side, html, domask){
  var leaf = $('<div class="leaf nobackside"><div class="content nobackside">' + html + '</div></div>');
  if(this.options.apply_pageclass){
    leaf.find('.content').addClass(this.options.apply_pageclass);
  }
  leaf.data('side', side);
  leaf.width(this.size.width).height(this.size.height);
  return leaf;
}

PageTurner.prototype.create_double_leaf = function(beforehtml, afterhtml){
  var beforeleaf = this.create_leaf('right', beforehtml, true);
  var afterleaf = this.create_leaf('left', afterhtml, true);
  beforeleaf.addClass('beforeleaf');
  afterleaf.addClass('afterleaf');
  var double_leaf = $('<div class="leafholder maintain3d"></div>');  
  var edge = $('<div class="nobackside leafedge"></div>');  
  double_leaf.width(this.size.width).height(this.size.height);
  double_leaf.append(afterleaf).append(beforeleaf);
  double_leaf.append(edge);
  setRotation(beforeleaf, 180);
  setRotation(edge, -90);
  return double_leaf;
}

/*

  manually set the rotation of either side

  i.e. 'left', .89

  would turn the left hand side .89 * 180 degrees to the right

  i.e. 'right', .89

  would turn the left hand side 180 - (.89 * 180) degrees to the right
  
*/
PageTurner.prototype.set_leaf_rotation = function(side, percent){
  var leaf = this['leaf' + side];

  var rotation = side=='left' ? (percent * 180) : (180 - (percent * 180));

  setRotation(leaf, rotation);
}


/*

  animate the book sequentially either left (-1) or right (1)
  
*/
PageTurner.prototype.animate_direction = function(direction){
  var self = this;
  if(!self.active){
    return;
  }
  
  var nextpage = this.currentpage + direction;

  if(nextpage<0 || nextpage>=this.page_html.length){
    return;
  }

  self.active = false;

  var side = direction<0 ? 'left' : 'right';
  var otherside = (side=='left' ? 'right' : 'left');
  var leaf = this['leaf' + side];
  var otherleaf = this['leaf' + otherside];
  var base = this['base' + side];
  var otherbase = this['base' + otherside];

  base.show();

  if(leaf.index()==0){
    otherleaf.insertBefore(leaf);
    otherbase.insertBefore(base);
  }

/*
  leaf.find('.leaf').each(function(){
    self.processmask($(this), self.options.masksize);  
  })
*/

  setAnimationTime(leaf, self.options.animtime);
  setRotation(leaf, side=='left' ? 180 : 0);

  self.emit('animate', side);
  
  setTimeout(function(){
    self.emit('animated', side);
    self.load_page(nextpage);
  }, self.options.animtime + 100)
}

/*

  animate the book after having shifted the pages around so a non-sequential page is the target
  
*/
PageTurner.prototype.animate_index = function(index){

}



function setLeafTransform(elem){
  var el = elem.get(0);

  var rotation = elem.data('rot') || 0;
  var z = elem.data('z') || 0;

  if (transform) {
    if (has3d) {
      var props = [];

      if(rotation!=0){
        props.push('rotateY(' + rotation + 'deg)');
      }

      if(z!=0){
        props.push('translateZ(' + z + 'px)');
      }

      var propsst = props.join(' ');

      el.style[transform] = propsst;
    } else {
      //el.style[transform] = 'translate(' + x + 'px,' + y + 'px)';
    }
  } else {
    //el.style.left = x;
    //el.style.top = y;
  }
}

function setZ(elem, amount){
  elem.data('z', amount);
  setLeafTransform(elem);
}

function setRotation(elem, amount){
  elem.data('rot', amount);
  setLeafTransform(elem);
}

function setAnimationTime(elem, ms){
  ['', '-webkit-', '-moz-', '-ms-', '-o-'].forEach(function(prefix){
    elem.css(prefix + 'transition', 'all ' + ms + 'ms');
  })
}

function setPerspective(elem, amount){
  ['', '-webkit-', '-moz-', '-ms-', '-o-'].forEach(function(prefix){
    elem.css(prefix + 'perspective', amount + 'px');
  })
}