/* Jack's Flight Tracker — MapLibre vector map adapter.
 * Replaces raster Leaflet tile panes, which showed gaps on iOS.
 * Provider: OpenFreeMap vector tiles (no API key); alternate CARTO dark style.
 * Keep L-like methods so flight logic and saved-aircraft controls stay unchanged.
 */
(function (global) {
  'use strict';
  const STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
  const STYLE_STREETS = 'https://tiles.openfreemap.org/styles/liberty';

  function validPoint(latlon) {
    return Array.isArray(latlon) && latlon.length === 2 &&
      Number.isFinite(Number(latlon[0])) && Number.isFinite(Number(latlon[1]));
  }
  function coordinates(latlon) { return [Number(latlon[1]), Number(latlon[0])]; }
  function lineGeometry(points) {
    return {type: 'Feature', properties: {}, geometry: {
      type: 'LineString', coordinates: points.filter(validPoint).map(coordinates)
    }};
  }

  class Map {
    constructor(id) {
      if (!global.maplibregl || typeof global.maplibregl.Map !== 'function' || (typeof global.maplibregl.supported === 'function' && !global.maplibregl.supported())) {
        const elem=document.getElementById(id);
        if(elem) {
          elem.textContent='This browser cannot display the vector map. Try Safari or another modern browser.';
          elem.style.padding='25px';
          elem.style.color='#fff';
        }
        throw Error('MapLibre WebGL is not available on this browser.');
      }
      this.view=new global.maplibregl.Map({
        container:id,style:STYLE_DARK,
        center:[-85.15,41.1],zoom:9,
        attributionControl:true,dragRotate:false,pitchWithRotate:false,
        fadeDuration:0,renderWorldCopies:false,
        cooperativeGestures:false
      });
      this.view.addControl(new global.maplibregl.NavigationControl({showCompass:false}),'top-right');
      this.view.on('error',ev=>{
        const error=ev&&ev.error;
        if(error)console.warn('Map tiles/style:',error.message||error);
      });
    }
    setView(latlon,zoom){
      if(!validPoint(latlon))return this;
      this.view.jumpTo({center:coordinates(latlon),zoom:zoom??this.view.getZoom()});
      return this;
    }
    panTo(latlon){
      if(validPoint(latlon))this.view.easeTo({center:coordinates(latlon),duration:500});
      return this;
    }
    invalidateSize(){this.view.resize();return this;}
    whenReady(fn){if(this.view.loaded())fn();else this.view.once('load',fn);}
    removeLayer(layer){if(layer&&typeof layer.remove==='function')layer.remove();return this;}
    changeStyle(kind){this.view.setStyle(kind==='streets'?STYLE_STREETS:STYLE_DARK);}
  }
  class Tiles {
    addTo(map){this.map=map;return this;}
    on(event,fn){
      if(event==='tileerror' && this.map)this.map.view.on('error',fn);
      return this;
    }
    redraw(){
      if(this.map){this.map.view.resize();this.map.view.triggerRepaint();}
      return this;
    }
  }
  class Marker {
    constructor(point, opts){
      this.point=point;
      this.icon=opts&&opts.icon;
      this.element=document.createElement('div');
      this.element.className='plane-pin';
      this.element.innerHTML=this.icon&&this.icon.html||'✈';
    }
    addTo(map){
      this.map=map;
      this.marker=new global.maplibregl.Marker({element:this.element,anchor:'center'})
        .setLngLat(coordinates(this.point)).addTo(map.view);
      return this;
    }
    bindPopup(label){
      this.marker?.setPopup(new global.maplibregl.Popup({offset:24}).setText(String(label)));
      return this;
    }
    setLatLng(point){this.point=point;this.marker?.setLngLat(coordinates(point));return this;}
    setIcon(icon){this.icon=icon;this.element.innerHTML=icon.html||'✈';return this;}
    remove(){this.marker?.remove();}
  }
  let nextID=0;
  class Polyline {
    constructor(points,opts){
      this.points=points;
      this.opts=opts||{};
      this.id='jft-plane-trail-'+(++nextID);
      this.listener=()=>this.draw();
    }
    addTo(map){
      this.map=map;
      map.view.on('style.load',this.listener);
      this.draw();
      return this;
    }
    draw(){
      const map=this.map?.view;
      if(!map||!map.isStyleLoaded()||this.removed)return;
      if(!map.getSource(this.id)){
        map.addSource(this.id,{type:'geojson',data:lineGeometry(this.points)});
      }
      if(!map.getLayer(this.id))map.addLayer({
        id:this.id,type:'line',source:this.id,
        layout:{'line-cap':'round','line-join':'round'},
        paint:{'line-color':this.opts.color||'#59d5e7','line-opacity':this.opts.opacity??.8,'line-width':this.opts.weight||3}
      });
    }
    setLatLngs(points){
      this.points=points;
      const source=this.map?.view.getSource(this.id);
      if(source)source.setData(lineGeometry(points));else this.draw();
      return this;
    }
    remove(){
      this.removed=true;
      const map=this.map?.view;
      if(map){
        map.off('style.load',this.listener);
        if(map.getLayer(this.id))map.removeLayer(this.id);
        if(map.getSource(this.id))map.removeSource(this.id);
      }
    }
  }
  global.L={
    map:(id)=>new Map(id),
    tileLayer:()=>new Tiles(),
    marker:(point,opts)=>new Marker(point,opts),
    divIcon:opts=>opts,
    polyline:(points,opts)=>new Polyline(points,opts)
  };
})(window);
