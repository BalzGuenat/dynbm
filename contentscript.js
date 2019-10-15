"use strict";

function getDomPath(el) {
  var stack = [];
  while ( el.parentNode != null ) {
    // console.log(el.nodeName);
    var sibCount = 0;
    var sibIndex = 0;
    for ( var i = 0; i < el.parentNode.childNodes.length; i++ ) {
      var sib = el.parentNode.childNodes[i];
      if ( sib.nodeName == el.nodeName ) {
        if ( sib === el ) {
          sibIndex = sibCount;
          break;
        }
        sibCount++;
      }
    }
    stack.unshift({
      name: el.nodeName.toLowerCase(),
      sibIdx: sibIndex,
      elem: el
    });
    el = el.parentNode;
  }
  return stack.slice(1); // removes the html element
}

function slicePath(path, first) {
  var idx = 0;
  for (var i = 0; i < path.length; i++) {
    if (path[i].elem === first) {
      idx = i;
      break;
    }
  }
  if (i >= 0) {
    // if not found, idx is 0 and the entire path is returned.
    return path.slice(i);
  }
}

function doSmartThings(containerElem, exampleElem, port) {
  // console.log("container: " + containerElem);
  // console.log("example: " + exampleElem);
  const rootPath = getDomPath(exampleElem);
  // console.log(rootPath.map(i => i.name).join(" > "));
  const contPath = slicePath(rootPath, containerElem);
  // console.log(contPath.map(i => i.name).join(" > "));
  // remove container
  let fromCont = contPath.slice(1);
  let first = contPath[0];
  let rest = fromCont.slice(1);
  let selector = first.name + " " + rest.map(e => e.name + ":nth-of-type(" + (e.sibIdx + 1) + ")").join(" ");
  console.log(selector);
  port.postMessage({
    action: "showSelector",
    selector
  });
  console.log("Container: " + containerElem.nodeName.toLowerCase() + "." + containerElem.className)
  let list = Array.from(containerElem.querySelectorAll(selector));
  console.log("Length: " + list.length);
  // console.log(list);
  // console.log(JSON.stringify(list.map(e => e.name + e.class).join(" > "), null, 4));
  return list;
}

(() => {
  if (window.hasRunContentScriptOnce === true) return;
  window.hasRunContentScriptOnce = true;
  
  browser.runtime.onConnect.addListener(port => {
    if (port.name !== "portFromPopup") return;
    let targetElements;
  
    port.onMessage.addListener(msg => {
      if (msg.action === "getElementDescriptions") {
        let elem = browser.menus.getTargetElement(msg.targetElementId);
        setTargetElement(elem);
      } else if (msg.action === "highlightElement") {
        let targetElem = browser.menus.getTargetElement(msg.targetElementId);
        let element = targetElements[msg.elementIndex];
        if (element) highlightElement(element, targetElem, port);
        else removeHighlights();
      } else if (msg.action === "removeElement") {
        let element = targetElements[msg.elementIndex];
        if (element) {
          // When an element is removed, all of its descendants are removed too.
          // Update the UI, to show all nodes starting from the parent element.
          let parentElement = element.parentElement;
          element.remove();
          setTargetElement(parentElement);
        }
      } else if (msg.action === "makeList") {
        console.log("making list...")
        let targetElem = browser.menus.getTargetElement(msg.targetElementId);
        let element = targetElements[msg.elementIndex];
        if (element) {
          let listElems = doSmartThings(element, targetElem, port);
          console.log("bookmarking: " + listElems);
          folder = browser.bookmarks.create({
            title: currentTab.title
          });
          for (let i in listElems) {
            e = listElems[i];
            browser.bookmarks.create({
              title: e.text,
              parentId: folder.id,
              url: e.href
            });
          }
        }
      }
    });
    port.onDisconnect.addListener(() => {
      // Clean up when the port is disconnected (e.g. popup was closed).
      removeHighlights();
    });
  
    function setTargetElement(elem) {
      targetElements = [];
      while (elem) {
        targetElements.unshift(elem);
        elem = elem.parentElement;
      }
  
      // Reply with some description of the elements, so that the available
      // elements can be shown in the popup's UI.
      let descriptions = targetElements.map(elem => {
        // For example, take the first 100 characters of the HTML element.
        return elem.cloneNode().outerHTML.slice(0, 100);
      });
      port.postMessage({
        action: "elementDescriptions",
        descriptions,
      });
    }
  });

  var highlights = [];
  function createHighlightBox(elem, outline, color) {
    let boundingRect = elem.getBoundingClientRect();
    let highlightedBox = document.createElement("div");
    highlightedBox.style.outline = outline;
    highlightedBox.style.margin = "0";
    highlightedBox.style.border = "0";
    highlightedBox.style.padding = "0";
    highlightedBox.style.backgroundColor = color;
    highlightedBox.style.pointerEvents = "none";
    highlightedBox.style.zIndex = "2147483647";
    highlightedBox.style.position = "fixed";
    highlightedBox.style.top = boundingRect.top + "px";
    highlightedBox.style.left = boundingRect.left + "px";
    highlightedBox.style.width = boundingRect.width + "px";
    highlightedBox.style.height = boundingRect.height + "px";
    (document.body || document.documentElement).appendChild(highlightedBox);
    highlights.push(highlightedBox);
  }
  
  
  function highlightElement(container, exampleElem, port) {
    let listElems = doSmartThings(container, exampleElem, port);
    listElems.splice(listElems.indexOf(exampleElem), 1);
    removeHighlights();
    createHighlightBox(container, "2px dotted green", "rgba(0, 100, 0, 0.1)");
    createHighlightBox(exampleElem, "2px dotted red", "rgba(100, 0, 0, 0.3)");
    for (let i in listElems) {
      createHighlightBox(listElems[i], "2px dotted blue", "rgba(0, 0, 100, 0.3)");
    }
  }
  
  function removeHighlights() {
    for (let i in highlights) {
      highlights[i].remove();
    }
    highlights = [];
  }
})();
