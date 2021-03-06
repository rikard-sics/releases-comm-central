/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global HTMLElement, DateFacetVis, FacetContext, glodaFacetStrings, FacetUtils, PluralForm, logException */
class MozFacetDate extends HTMLElement {
  get build() {
    return this.buildFunc;
  }

  get brushItems() {
    return (items) => this.vis.hoverItems(items);
  }

  get clearBrushedItems() {
    return () => this.vis.clearHover();
  }

  connectedCallback() {
    const wrapper = document.createElement("div");
    wrapper.classList.add("facet", "date-wrapper");

    const h2 = document.createElement("h2");

    const canvas = document.createElement("div");
    canvas.classList.add("date-vis-frame");

    const zoomOut = document.createElement("div");
    zoomOut.classList.add("facet-date-zoom-out");
    zoomOut.setAttribute("role", "image");
    zoomOut.addEventListener("click", () => FacetContext.zoomOut());

    wrapper.appendChild(h2);
    wrapper.appendChild(canvas);
    wrapper.appendChild(zoomOut);
    this.appendChild(wrapper);

    this.canUpdate = true;
    this.canvasNode = canvas;
    this.vis = null;
    if ("faceter" in this) {
      this.buildFunc(true);
    }
  }

  buildFunc(aDoSize) {
    if (!this.vis) {
      this.vis = new DateFacetVis(this, this.canvasNode);
      this.vis.build();
    } else {
      while (this.canvasNode.hasChildNodes()) {
        this.canvasNode.lastChild.remove();
      }
      if (aDoSize) {
        this.vis.build();
      } else {
        this.vis.rebuild();
      }
    }
  }
}

class MozFacetBoolean extends HTMLElement {
  constructor() {
    super();

    this.addEventListener("mouseover", (event) => {
      FacetContext.hoverFacet(
        this.faceter,
        this.faceter.attrDef,
        true, this.trueValues
      );
    });

    this.addEventListener("mouseout", (event) => {
      FacetContext.unhoverFacet(
        this.faceter,
        this.faceter.attrDef,
        true,
        this.trueValues
      );
    });
  }

  connectedCallback() {
    this.addChildren();

    this.canUpdate = true;
    this.bubble.addEventListener("click", (event) => {
      return this.bubbleClicked(event);
    });

    if ("faceter" in this) {
      this.build(true);
    }
  }

  addChildren() {
    this.bubble = document.createElement("span");
    this.bubble.classList.add("facet-checkbox-bubble");

    this.checkbox = document.createElement("input");
    this.checkbox.setAttribute("type", "checkbox");

    this.labelNode = document.createElement("span");
    this.labelNode.classList.add("facet-checkbox-label");

    this.countNode = document.createElement("span");
    this.countNode.classList.add("facet-checkbox-count");

    this.bubble.appendChild(this.checkbox);
    this.bubble.appendChild(this.labelNode);
    this.bubble.appendChild(this.countNode);

    this.appendChild(this.bubble);
  }

  set disabled(val) {
    if (val) {
      this.setAttribute("disabled", "true");
      this.checkbox.setAttribute("disabled", "true");
    } else {
      this.removeAttribute("disabled");
      this.checkbox.removeAttribute("disabled");
    }
  }

  get disabled() {
    return this.getAttribute("disabled") == "true";
  }

  set checked(val) {
    if (this.checked == val) {
      return;
    }
    this.checkbox.checked = val;
    if (val) {
      this.setAttribute("checked", "true");
      if (!this.disabled) {
        FacetContext.addFacetConstraint(
          this.faceter,
          true,
          this.trueGroups
        );
      }
    } else {
      this.removeAttribute("checked");
      this.checkbox.removeAttribute("checked");
      if (!this.disabled) {
        FacetContext.removeFacetConstraint(
          this.faceter,
          true,
          this.trueGroups
        );
      }
    }
    this.checkStateChanged();
  }

  get checked() {
    return this.getAttribute("checked") == "true";
  }

  extraSetup() { }

  checkStateChanged() { }

  brushItems() { }

  clearBrushedItems() { }

  build(firstTime) {
    if (firstTime) {
      this.labelNode.textContent = this.facetDef.strings.facetNameLabel;
      this.checkbox.setAttribute(
        "aria-label",
        this.facetDef.strings.facetNameLabel
      );
      this.trueValues = [];
    }

    // If we do not currently have a constraint applied and there is only
    //  one (or no) group, then: disable us, but reflect the underlying
    //  state of the data (checked or non-checked)
    if (!this.faceter.constraint && (this.orderedGroups.length <= 1)) {
      this.disabled = true;
      let count = 0;
      if (this.orderedGroups.length) {
        // true case?
        if (this.orderedGroups[0][0]) {
          count = this.orderedGroups[0][1].length;
          this.checked = true;
        } else {
          this.checked = false;
        }
      }
      this.countNode.textContent = count.toLocaleString();
      return;
    }
    // if we were disabled checked before, clear ourselves out
    if (this.disabled && this.checked) {
      this.checked = false;
    }
    this.disabled = false;

    // if we are here, we have our 2 groups, find true...
    // (note: it is possible to get jerked around by null values
    //  currently, so leave a reasonable failure case)
    this.trueValues = [];
    this.trueGroups = [true];
    for (let groupPair of this.orderedGroups) {
      if (groupPair[0]) {
        this.trueValues = groupPair[1];
      }
    }

    this.countNode.textContent = this.trueValues.length.toLocaleString();
  }

  bubbleClicked(event) {
    if (!this.disabled) {
      this.checked = !this.checked;
    }
    event.stopPropagation();
  }
}

class MozFacetBooleanFiltered extends MozFacetBoolean {
  static get observedAttributes() {
    return ["checked", "disabled"];
  }

  connectedCallback() {
    super.addChildren();

    this.filterNode = document.createElement("select");
    this.filterNode.classList.add("facet-filter-list");
    this.appendChild(this.filterNode);

    this.canUpdate = true;
    this.bubble.addEventListener("click", (event) => {
      return super.bubbleClicked(event);
    });

    this.extraSetup();

    if ("faceter" in this) {
      this.build(true);
    }

    this._updateAttributes();
  }

  attributeChangedCallback() {
    this._updateAttributes();
  }

  _updateAttributes() {
    if (!this.checkbox) {
      return;
    }

    if (this.hasAttribute("checked")) {
      this.checkbox.setAttribute("checked", this.getAttribute("checked"));
    } else {
      this.checkbox.removeAttribute("checked");
    }

    if (this.hasAttribute("disabled")) {
      this.checkbox.setAttribute("disabled", this.getAttribute("disabled"));
    } else {
      this.checkbox.removeAttribute("disabled");
    }
  }

  extraSetup() {
    this.groupDisplayProperty = this.getAttribute("groupDisplayProperty");

    this.filterNode.addEventListener("change", (event) => this.filterChanged(event));

    this.selectedValue = "all";
  }

  build(firstTime) {
    if (firstTime) {
      this.labelNode.textContent = this.facetDef.strings.facetNameLabel;
      this.checkbox.setAttribute("aria-label", this.facetDef.strings.facetNameLabel);
      this.trueValues = [];
    }

    // Only update count if anything other than "all" is selected.
    // Otherwise we lose the set of attachment types in our select box,
    // and that makes us sad.  We do want to update on "all" though
    // because other facets may further reduce the number of attachments
    // we see.  (Or if this is not just being used for attachments, it
    // still holds.)
    if (this.selectedValue != "all") {
      let count = 0;
      for (let groupPair of this.orderedGroups) {
        if (groupPair[0] != null)
          count += groupPair[1].length;
      }
      this.countNode.textContent = count.toLocaleString();
      return;
    }

    while (this.filterNode.hasChildNodes()) {
      this.filterNode.lastChild.remove();
    }

    let allNode = document.createElement("option");
    allNode.textContent =
      glodaFacetStrings.get(
        "glodaFacetView.facets.filter." + this.attrDef.attributeName + ".allLabel"
      );
    allNode.setAttribute("value", "all");
    if (this.selectedValue == "all") {
      allNode.setAttribute("selected", "selected");
    }
    this.filterNode.appendChild(allNode);

    // if we are here, we have our 2 groups, find true...
    // (note: it is possible to get jerked around by null values
    // currently, so leave a reasonable failure case)
    // empty true groups is for the checkbox
    this.trueGroups = [];
    // the real true groups is the actual true values for our explicit
    // filtering
    this.realTrueGroups = [];
    this.trueValues = [];
    this.falseValues = [];
    let selectNodes = [];
    for (let groupPair of this.orderedGroups) {
      if (groupPair[0] === null) {
        this.falseValues.push.apply(this.falseValues, groupPair[1]);
      } else {
        this.trueValues.push.apply(this.trueValues, groupPair[1]);

        let groupValue = groupPair[0];
        let selNode = document.createElement("option");
        selNode.textContent = groupValue[this.groupDisplayProperty];
        selNode.setAttribute("value", this.realTrueGroups.length);
        if (this.selectedValue == groupValue.category) {
          selNode.setAttribute("selected", "selected");
        }
        selectNodes.push(selNode);

        this.realTrueGroups.push(groupValue);
      }
    }
    selectNodes.sort((a, b) => {
      return a.textContent.localeCompare(b.textContent);
    });
    selectNodes.forEach((selNode) => { this.filterNode.appendChild(selNode); });

    this.disabled = !this.trueValues.length;

    this.countNode.textContent = this.trueValues.length.toLocaleString();
  }

  checkStateChanged() {
    // if they un-check us, revert our value to all.
    if (!this.checked)
      this.selectedValue = "all";
  }

  filterChanged(event) {
    if (!this.checked) {
      return;
    }
    if (this.filterNode.value == "all") {
      this.selectedValue = "all";
      FacetContext.addFacetConstraint(
        this.faceter,
        true,
        this.trueGroups,
        false,
        true
      );
    } else {
      let groupValue = this.realTrueGroups[parseInt(this.filterNode.value)];
      this.selectedValue = groupValue.category;
      FacetContext.addFacetConstraint(this.faceter, true, [groupValue], false, true);
    }
  }
}

class MozFacetDiscrete extends HTMLElement {
  constructor() {
    super();

    this.addEventListener("click", (event) => { this.showPopup(event); });

    this.addEventListener("keypress", (event) => {
      if (event.keyCode != KeyEvent.DOM_VK_RETURN) {
        return;
      }
      this.showPopup(event);
    });

    this.addEventListener("keypress", (event) => { this.activateLink(event); });

    this.addEventListener("mouseover", (event) => {
      // we dispatch based on the class of the thing we clicked on.
      // there are other ways we could accomplish this, but they all sorta suck.
      if (event.originalTarget.hasAttribute("class") &&
        event.originalTarget.classList.contains("bar-link")) {
        this.barHovered(event.originalTarget.parentNode, true);
      }
    });

    this.addEventListener("mouseout", (event) => {
      // we dispatch based on the class of the thing we clicked on.
      // there are other ways we could accomplish this, but they all sorta suck.
      if (event.originalTarget.hasAttribute("class") &&
        event.originalTarget.classList.contains("bar-link")) {
        this.barHoverGone(event.originalTarget.parentNode, true);
      }
    });

  }

  connectedCallback() {
    const facet = document.createElement("div");
    facet.classList.add("facet");

    this.nameNode = document.createElement("h2");

    this.contentBox = document.createElement("div");
    this.contentBox.classList.add("facet-content");

    this.includeLabel = document.createElement("h3");
    this.includeLabel.classList.add("facet-included-header");

    this.includeList = document.createElement("ul");
    this.includeList.classList.add("facet-included", "barry");

    this.remainderLabel = document.createElement("h3");
    this.remainderLabel.classList.add("facet-remaindered-header");

    this.remainderList = document.createElement("ul");
    this.remainderList.classList.add("facet-remaindered", "barry");

    this.excludeLabel = document.createElement("h3");
    this.excludeLabel.classList.add("facet-excluded-header");

    this.excludeList = document.createElement("ul");
    this.excludeList.classList.add("facet-excluded", "barry");

    this.moreButton = document.createElement("div");
    this.moreButton.classList.add("facet-more");
    this.moreButton.setAttribute("needed", "false");
    this.moreButton.setAttribute("tabindex", "0");
    this.moreButton.setAttribute("role", "button");

    this.contentBox.appendChild(this.includeLabel);
    this.contentBox.appendChild(this.includeList);
    this.contentBox.appendChild(this.remainderLabel);
    this.contentBox.appendChild(this.remainderList);
    this.contentBox.appendChild(this.excludeLabel);
    this.contentBox.appendChild(this.excludeList);
    this.contentBox.appendChild(this.moreButton);

    facet.appendChild(this.nameNode);
    facet.appendChild(this.contentBox);

    this.appendChild(facet);

    this.canUpdate = false;

    if ("faceter" in this) {
      this.build(true);
    }
  }

  build(firstTime) {
    // -- Header Building
    this.nameNode.textContent = this.facetDef.strings.facetNameLabel;

    // - include
    // setup the include label
    if ("includeLabel" in this.facetDef.strings) {
      this.includeLabel.textContent = this.facetDef.strings.includeLabel;
    } else {
      this.includeLabel.textContent =
        glodaFacetStrings.get("glodaFacetView.facets.included.fallbackLabel");
    }
    this.includeLabel.setAttribute("state", "empty");

    // - exclude
    // setup the exclude label
    if ("excludeLabel" in this.facetDef.strings) {
      this.excludeLabel.textContent = this.facetDef.strings.excludeLabel;
    } else {
      this.excludeLabel.textContent =
        glodaFacetStrings.get("glodaFacetView.facets.excluded.fallbackLabel");
    }
    this.excludeLabel.setAttribute("state", "empty");

    // - remainder
    // setup the remainder label
    if ("remainderLabel" in this.facetDef.strings) {
      this.remainderLabel.textContent = this.facetDef.strings.remainderLabel;
    } else {
      this.remainderLabel.textContent =
        glodaFacetStrings.get("glodaFacetView.facets.remainder.fallbackLabel");
    }

    // -- House-cleaning
    // -- All/Top mode decision
    this.modes = ["all"];
    if (this.maxDisplayRows >= this.orderedGroups.length) {
      this.mode = "all";
    } else {
      // top mode must be used
      this.modes.push("top");
      this.mode = "top";
      this.topGroups = FacetUtils.makeTopGroups(
        this.attrDef,
        this.orderedGroups,
        this.maxDisplayRows
      );
      // setup the more button string
      let groupCount = this.orderedGroups.length;
      this.moreButton.textContent =
        PluralForm.get(
          groupCount,
          glodaFacetStrings.get(
            "glodaFacetView.facets.mode.top.listAllLabel"
          )
        ).replace("#1", groupCount);
    }

    // -- Row Building
    this.buildRows();
  }

  changeMode(newMode) {
    this.mode = newMode;
    this.setAttribute("mode", newMode);
    this.buildRows();
  }

  buildRows() {
    let nounDef = this.nounDef;
    let useGroups = (this.mode == "all") ? this.orderedGroups : this.topGroups;

    // should we just rely on automatic string coercion?
    this.moreButton.setAttribute("needed", (this.mode == "top") ? "true" : "false");

    let constraint = this.faceter.constraint;

    // -- empty all of our display buckets...
    let remainderList = this.remainderList;
    while (remainderList.hasChildNodes()) {
      remainderList.lastChild.remove();
    }
    let includeList = this.includeList;
    let excludeList = this.excludeList;
    while (includeList.hasChildNodes()) {
      includeList.lastChild.remove();
    }
    while (excludeList.hasChildNodes()) {
      excludeList.lastChild.remove();
    }

    // -- first pass, check for ambiguous labels
    // It's possible that multiple groups are identified by the same short
    //  string, in which case we want to use the longer string to
    //  disambiguate.  For example, un-merged contacts can result in
    //  multiple identities having contacts with the same name.  In that
    //  case we want to display both the contact name and the identity
    //  name.
    // This is generically addressed by using the userVisibleString function
    //  defined on the noun type if it is defined.  It takes an argument
    //  indicating whether it should be a short string or a long string.
    // Our algorithm is somewhat dumb.  We get the short strings, put them
    //  in a dictionary that maps to whether they are ambiguous or not.  We
    //  do not attempt to map based on their id, so then when it comes time
    //  to actually build the labels, we must build the short string and
    //  then re-call for the long name.  We could be smarter by building
    //  a list of the input values that resulted in the output string and
    //  then using that to back-update the id map, but it's more compelx and
    //  the performance difference is unlikely to be meaningful.
    let ambiguousKeyValues;
    if ("userVisibleString" in nounDef) {
      ambiguousKeyValues = {};
      for (let groupPair of useGroups) {
        let [groupValue] = groupPair;

        // skip null values, they are handled by the none special-case
        if (groupValue == null) {
          continue;
        }

        let groupStr = nounDef.userVisibleString(groupValue, false);
        // We use hasOwnProperty because it is possible that groupStr could
        //  be the same as the name of one of the attributes on
        //  Object.prototype.
        if (ambiguousKeyValues.hasOwnProperty(groupStr)) {
          ambiguousKeyValues[groupStr] = true;
        } else {
          ambiguousKeyValues[groupStr] = false;
        }
      }
    }

    // -- create the items, assigning them to the right list based on
    //  existing constraint values
    for (let groupPair of useGroups) {
      let [groupValue, groupItems] = groupPair;
      let li = document.createElement("li");
      li.setAttribute("class", "bar");
      li.setAttribute("tabindex", "0");
      li.setAttribute("role", "link");
      li.setAttribute("aria-haspopup", "true");
      li.groupValue = groupValue;
      li.setAttribute("groupValue", groupValue);
      li.groupItems = groupItems;

      let countSpan = document.createElement("span");
      countSpan.setAttribute("class", "bar-count");
      countSpan.textContent = groupItems.length.toLocaleString();
      li.appendChild(countSpan);

      let label = document.createElement("span");
      label.setAttribute("class", "bar-link");

      // The null value is a special indicator for 'none'
      if (groupValue == null) {
        label.textContent = glodaFacetStrings.get("glodaFacetView.facets.noneLabel");
      } else {
        // Otherwise stringify the group object
        let labelStr;
        if (ambiguousKeyValues) {
          labelStr = nounDef.userVisibleString(groupValue, false);
          if (ambiguousKeyValues[labelStr]) {
            labelStr = nounDef.userVisibleString(groupValue, true);
          }
        } else if ("labelFunc" in this.facetDef) {
          labelStr = this.facetDef.labelFunc(groupValue);
        } else {
          labelStr = groupValue.toLocaleString().substring(0, 80);
        }
        label.textContent = labelStr;
        label.setAttribute("title", labelStr);
      }
      li.appendChild(label);

      // root it under the appropriate list
      if (constraint) {
        if (constraint.isIncludedGroup(groupValue)) {
          li.setAttribute("variety", "include");
          includeList.appendChild(li);
        } else if (constraint.isExcludedGroup(groupValue)) {
          li.setAttribute("variety", "exclude");
          excludeList.appendChild(li);
        } else {
          li.setAttribute("variety", "remainder");
          remainderList.appendChild(li);
        }
      } else {
        li.setAttribute("variety", "remainder");
        remainderList.appendChild(li);
      }
    }

    this.updateHeaderStates();
  }

  /**
   * - Mark the include/exclude headers as "some" if there is anything in their
   * - lists, mark the remainder header as "needed" if either of include /
   * - exclude exist so we need that label.
   */
  updateHeaderStates(items) {
    this.includeLabel.setAttribute("state", this.includeList.childElementCount ? "some" : "empty");
    this.excludeLabel.setAttribute("state", this.excludeList.childElementCount ? "some" : "empty");
    this.remainderLabel.setAttribute("needed",
      (
        (
          this.includeList.childElementCount ||
          this.excludeList.childElementCount
        ) &&
        this.remainderList.childElementCount) ? "true" : "false"
    );

    // nuke the style attributes.
    this.includeLabel.removeAttribute("style");
    this.excludeLabel.removeAttribute("style");
    this.remainderLabel.removeAttribute("style");
  }

  brushItems(items) { }

  clearBrushedItems() { }

  afterListVisible(variety, callback) {
    let labelNode = this[variety + "Label"];
    let listNode = this[variety + "List"];

    // if there are already things displayed, no need
    if (listNode.childElementCount) {
      callback();
      return;
    }

    let remListVisible =
      this.remainderLabel.getAttribute("needed") == "true";
    let remListShouldBeVisible =
      this.remainderList.childElementCount > 1;

    labelNode.setAttribute("state", "some");

    let showNodes = [labelNode];
    if (remListVisible != remListShouldBeVisible) {
      showNodes = [labelNode, this.remainderLabel];
    }

    showNodes.forEach(node => node.style.display = "block");

    callback();
  }

  _flyBarAway(barNode, variety, callback) {
    function getRect(aElement) {
      let box = aElement.getBoundingClientRect();
      let documentElement = aElement.ownerDocument.documentElement;
      return {
        top: box.top + window.pageYOffset - documentElement.clientTop,
        left: box.left + window.pageXOffset - documentElement.clientLeft,
        width: box.width,
        height: box.height,
      };
    }
    // figure out our origin location prior to adding the target or it
    //  will shift us down.
    let origin = getRect(barNode);

    // clone the node into its target location
    let targetNode = barNode.cloneNode(true);
    targetNode.groupValue = barNode.groupValue;
    targetNode.groupItems = barNode.groupItems;
    targetNode.setAttribute("variety", variety);

    let targetParent = this[variety + "List"];
    targetParent.appendChild(targetNode);

    // create a flying clone
    let flyingNode = barNode.cloneNode(true);

    let dest = getRect(targetNode);

    // if the flying box wants to go higher than the content box goes, just
    //  send it to the top of the content box instead.
    let contentRect = getRect(this.contentBox);
    if (dest.top < contentRect.top) {
      dest.top = contentRect.top;
    }

    // likewise if it wants to go further south than the content box, stop
    //  that
    if (dest.top > (contentRect.top + contentRect.height)) {
      dest.top = contentRect.top + contentRect.height - dest.height;
    }

    flyingNode.style.position = "absolute";
    flyingNode.style.width = origin.width + "px";
    flyingNode.style.height = origin.height + "px";
    flyingNode.style.top = origin.top + "px";
    flyingNode.style.left = origin.left + "px";
    flyingNode.style.zIndex = 1000;

    flyingNode.style.transitionDuration = (Math.abs(dest.top - origin.top) * 2) + "ms";
    flyingNode.style.transitionProperty = "top, left";

    flyingNode.addEventListener("transitionend", () => {
      barNode.remove();
      targetNode.style.display = "block";
      flyingNode.remove();

      if (callback) {
        setTimeout(callback, 50);
      }
    });

    document.body.appendChild(flyingNode);

    setTimeout(() => {
      // animate the flying clone... flying!
      window.requestAnimationFrame(() => {
        flyingNode.style.top = dest.top + "px";
        flyingNode.style.left = dest.left + "px";
      });

      // hide the target (cloned) node
      targetNode.style.display = "none";

      // hide the original node and remove its JS properties
      barNode.style.visibility = "hidden";
      delete barNode.groupValue;
      delete barNode.groupItems;
    }, 0);
  }

  barClicked(barNode, variety) {
    let groupValue = barNode.groupValue;
    // These determine what goAnimate actually does.
    // flyAway allows us to cancel flying in the case the constraint is
    //  being fully dropped and so the facet is just going to get rebuilt
    let flyAway = true;

    const goAnimate = () => {
      setTimeout(() => {
        if (flyAway) {
          this.afterListVisible(variety, () => {
            this._flyBarAway(barNode, variety, () => {
              this.updateHeaderStates();
            });
          });
        }
      }, 0);
    };

    // Immediately apply the facet change, triggering the animation after
    //  the faceting completes.
    if (variety == "remainder") {
      let currentVariety = barNode.getAttribute("variety");
      let constraintGone = FacetContext.removeFacetConstraint(
        this.faceter,
        currentVariety == "include", [groupValue],
        goAnimate
      );

      // we will automatically rebuild if the constraint is gone, so
      //  just make the animation a no-op.
      if (constraintGone) {
        flyAway = false;
      }
    } else { // include/exclude
      let revalidate = FacetContext.addFacetConstraint(
        this.faceter,
        variety == "include", [groupValue],
        false, false, goAnimate
      );

      // revalidate means we need to blow away the other dudes, in which
      //  case it makes the most sense to just trigger a rebuild of ourself
      if (revalidate) {
        flyAway = false;
        this.build(false);
      }
    }
  }

  barHovered(barNode, aInclude) {
    let groupValue = barNode.groupValue;
    let groupItems = barNode.groupItems;

    FacetContext.hoverFacet(this.faceter, this.attrDef, groupValue, groupItems);
  }

  /**
   * HoverGone! HoverGone!
   * We know it's gone, but where has it gone?
   */
  barHoverGone(barNode, include) {
    let groupValue = barNode.groupValue;
    let groupItems = barNode.groupItems;

    FacetContext.unhoverFacet(this.faceter, this.attrDef, groupValue, groupItems);
  }

  includeFacet(node) {
    this.barClicked(
      node,
      (node.getAttribute("variety") == "remainder") ? "include" : "remainder"
    );
  }

  undoFacet(node) {
    this.barClicked(
      node,
      (node.getAttribute("variety") == "remainder") ? "include" : "remainder"
    );
  }

  excludeFacet(node) {
    this.barClicked(node, "exclude");
  }

  showPopup(event) {
    try {
      // event.originalTarget could be the <li> node, or a span inside
      // of it, or perhaps the facet-more button, or maybe something
      // else that we'll handle in the next version.  We walk up its
      // parent chain until we get to the right level of the DOM
      // hierarchy, or the facet-content which seems to be the root.
      if (this.currentNode) {
        this.currentNode.removeAttribute("selected");
      }

      let node = event.originalTarget;

      while (
        (!(node && node.hasAttribute && node.hasAttribute("class"))) ||
        (
          !node.classList.contains("bar") &&
          !node.classList.contains("facet-more") &&
          !node.classList.contains("facet-content")
        )
      ) {
        node = node.parentNode;
      }

      if (!(node && node.hasAttribute && node.hasAttribute("class"))) {
        return false;
      }

      this.currentNode = node;
      node.setAttribute("selected", "true");

      if (node.classList.contains("bar")) {
        document.getElementById("popup-menu").show(event, this, node);
      } else if (node.classList.contains("facet-more")) {
        this.changeMode("all");
      }

      return false;
    } catch (e) {
      return logException(e);
    }
  }

  activateLink(event) {
    try {
      let node = event.originalTarget;

      while (
        !node.hasAttribute("class") ||
        (
          !node.classList.contains("facet-more") &&
          !node.classList.contains("facet-content")
        )
      ) {
        node = node.parentNode;
      }

      if (node.classList.contains("facet-more")) {
        this.changeMode("all");
      }

      return false;
    } catch (e) {
      return logException(e);
    }
  }
}

customElements.define("facet-date", MozFacetDate);
customElements.define("facet-boolean", MozFacetBoolean);
customElements.define("facet-boolean-filtered", MozFacetBooleanFiltered);
customElements.define("facet-discrete", MozFacetDiscrete);
