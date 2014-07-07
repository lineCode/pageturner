var Emitter = require('emitter')
var domify = require('domify')
var css = require('css')
var tools = require('./tools')

module.exports = factory

function factory(html){
  return new Page(html)
}

function Page(html){
  this.html = html
}

Emitter(Page.prototype)

// create a pair of leaves and populate this.pages
Page.prototype.render = function(){
  var self = this;
  
  if(this.leaves){
    return this.leaves
  }

  this.leaves = {
    left:this.createLeaf('left'),
    right:this.createLeaf('right')
  }

  return this.leaves
}


Page.prototype.createLeaf = function(side){
  var leaf = domify('<div class="leaf nobackside filler"><div class="content filler">' + this.html + '</div></div>')
  leaf.setAttribute('data-side', side)
  return leaf;
}

/*

  manually set the rotation of either side

  i.e. 'left', .89

  would turn the left hand side .89 * 180 degrees to the right

  i.e. 'right', .89

  would turn the left hand side 180 - (.89 * 180) degrees to the right
  
*/
Page.prototype.setLeafRotation = function(side, percent){
  var leaf = this['leaf' + side];

  var rotation = side=='left' ? (percent * 180) : (180 - (percent * 180));

  setRotation(leaf, rotation);
}


Page.prototype.processMask = function(leaf, val, parent){
  var size = {
    width:parent.offsetWidth,
    height:parent.offsetHeight
  }

  var usemask = arguments.length==2 ? val : 0;

  // clip: rect(<top>, <right>, <bottom>, <left>);
  var rect = leaf.getAttribute('data-side') == 'left' ? 
    'rect(0px, ' + (Math.ceil(size.width/2)+usemask) + 'px, ' + (size.height) + 'px, 0px)' :
    'rect(0px, ' + (size.width) + 'px, ' + (size.height) + 'px, ' + (Math.floor(size.width/2)-usemask) + 'px)'

  css(leaf, {
    'clip':rect
  })
}


Page.prototype.attach = function(parent){
  var page = this.render()
  parent.appendChild(page.left)
  parent.appendChild(page.right)

  if(tools.is3d()){
    this.processMask(page.left, 0, parent)
    this.processMask(page.right, 0, parent)
  }
}


Page.prototype.remove = function(){
  var page = this.render()
  page.left.parentNode.removeChild(page.left)
  page.right.parentNode.removeChild(page.right)
}

Page.prototype.setVisible = function(mode){
  var o = mode ? 1 : 0;
  var leaves = this.render()
  console.log('-------------------------------------------');
  console.log('visible')
  console.log(mode)
  css(leaves.left, {
    opacity:o,
    'z-index':0
  })
  css(leaves.right, {
    opacity:o,
    'z-index':0
  })
}

Page.prototype.setRotation = function(side, amount){
  if(tools.is3d()){
    var leaves = this.render()
    tools.setRotation(leaves[side], amount)
  }
}