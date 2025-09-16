// Face camera component with cached camera
AFRAME.registerComponent("face-camera", {
  init: function () {
    this.cameraObj = document.querySelector("[camera]").object3D;
  },
  tick: function () {
    if (this.cameraObj) {
      this.el.object3D.lookAt(this.cameraObj.position);
    }
  },
});

// Hotspot Editor Manager
class HotspotEditor {
  constructor() {
    this.hotspots = [];
    this.editMode = false;
    this.selectedHotspotType = "text";
    this.hotspotIdCounter = 0;
    this.selectedHotspotId = null;
    this.scenes = {
      room1: {
        name: "Room 1",
        image: "./images/room1.jpg",
        hotspots: [],
        startingPoint: null, // { rotation: { x: 0, y: 0, z: 0 } }
      },
    };
    this.currentScene = "room1";
    this.navigationMode = false; // false = edit mode, true = navigation mode

    this.init();
  }

  init() {
    this.bindEvents();
    this.setupHotspotTypeSelection();
    this.setupSceneManagement();
    this.loadCurrentScene();
  }

  bindEvents() {
    // Add hotspot button
    document.getElementById("add-hotspot").addEventListener("click", () => {
      this.enterEditMode();
    });

    // Clear hotspots button
    document.getElementById("clear-hotspots").addEventListener("click", () => {
      this.clearAllHotspots();
    });

    // Save template button
    document.getElementById("save-template").addEventListener("click", () => {
      this.saveTemplate();
    });

    // Load template button
    document.getElementById("load-template").addEventListener("click", () => {
      this.loadTemplate();
    });

    // Sky click event for placing or repositioning hotspots
    document.getElementById("skybox").addEventListener("click", (evt) => {
      // Reposition has highest precedence
      if (this.repositioningHotspotId) {
        this.applyReposition(evt);
        return;
      }
      if (this.editMode) {
        this.placeHotspot(evt);
      }
    });

    // Edit mode toggle
    document
      .getElementById("edit-mode-toggle")
      .addEventListener("change", (e) => {
        this.navigationMode = !e.target.checked;
        this.updateModeIndicator();
      });

    // Scene management
    document.getElementById("add-scene").addEventListener("click", () => {
      this.addNewScene();
    });

    document.getElementById("manage-scenes").addEventListener("click", () => {
      this.showSceneManager();
    });

    document.getElementById("current-scene").addEventListener("change", (e) => {
      this.switchToScene(e.target.value);
    });

    // Starting point controls
    document
      .getElementById("set-starting-point")
      .addEventListener("click", () => {
        this.setStartingPoint();
      });

    document
      .getElementById("clear-starting-point")
      .addEventListener("click", () => {
        this.clearStartingPoint();
      });

    // Audio input coordination - clear URL when file is selected
    document.getElementById("hotspot-audio").addEventListener("change", () => {
      if (document.getElementById("hotspot-audio").files.length > 0) {
        document.getElementById("hotspot-audio-url").value = "";
      }
    });

    // Audio URL coordination - clear file when URL is entered
    document
      .getElementById("hotspot-audio-url")
      .addEventListener("input", () => {
        if (document.getElementById("hotspot-audio-url").value.trim()) {
          document.getElementById("hotspot-audio").value = "";
        }
      });
  }

  setupHotspotTypeSelection() {
    const typeElements = document.querySelectorAll(".hotspot-type");
    typeElements.forEach((element) => {
      element.addEventListener("click", () => {
        // Remove selected class from all
        typeElements.forEach((el) => el.classList.remove("selected"));
        // Add selected class to clicked element
        element.classList.add("selected");
        // Update radio button
        const radio = element.querySelector('input[type="radio"]');
        radio.checked = true;
        this.selectedHotspotType = radio.value;

        // Update field requirements visibility
        this.updateFieldRequirements();
      });
    });

    // Initialize field requirements for default selection
    this.updateFieldRequirements();
  }

  updateFieldRequirements() {
    const textGroup = document.querySelector(
      'label[for="hotspot-text"]'
    ).parentElement;
    const audioGroup = document.querySelector(
      'label[for="hotspot-audio"]'
    ).parentElement;
    const audioUrlGroup = document.querySelector(
      'label[for="hotspot-audio-url"]'
    ).parentElement;
    const navigationGroup = document.getElementById("navigation-target-group");
    const textLabel = document.querySelector('label[for="hotspot-text"]');
    const audioLabel = document.querySelector('label[for="hotspot-audio"]');
    const labelLabel = document.querySelector('label[for="hotspot-label"]');

    // Reset labels
    textLabel.innerHTML = "Text Content:";
    audioLabel.innerHTML = "Audio File:";
    labelLabel.innerHTML = "Label:";

    // Reset visibility
    textGroup.style.display = "block";
    audioGroup.style.display = "block";
    audioUrlGroup.style.display = "block";
    navigationGroup.style.display = "none";

    switch (this.selectedHotspotType) {
      case "text":
        textLabel.innerHTML =
          'Text Content: <span style="color: #f44336;">*Required</span>';
        audioGroup.style.display = "none";
        audioUrlGroup.style.display = "none";
        break;

      case "audio":
        audioLabel.innerHTML =
          'Audio File: <span style="color: #f44336;">*Required</span>';
        textGroup.style.display = "none";
        break;

      case "text-audio":
        textLabel.innerHTML =
          'Text Content: <span style="color: #f44336;">*Required</span>';
        audioLabel.innerHTML =
          'Audio File: <span style="color: #f44336;">*Required</span>';
        break;

      case "navigation":
        textGroup.style.display = "none";
        audioGroup.style.display = "none";
        audioUrlGroup.style.display = "none";
        navigationGroup.style.display = "block";
        labelLabel.innerHTML =
          'Label: <span style="color: #f44336;">*Required</span>';
        this.updateNavigationTargets();
        break;
    }
  }

  enterEditMode() {
    this.editMode = true;
    document.getElementById("edit-indicator").style.display = "block";
    this.updateModeIndicator(); // Keep instructions consistent
  }

  exitEditMode() {
    this.editMode = false;
    document.getElementById("edit-indicator").style.display = "none";
    this.updateModeIndicator(); // Keep instructions consistent
  }

  placeHotspot(evt) {
    if (!this.editMode) return;

    // Validate required fields based on hotspot type
    const validationResult = this.validateHotspotData();
    if (!validationResult.valid) {
      alert(validationResult.message);
      return;
    }

    // Get intersection point from the click event
    const intersection = evt.detail.intersection;
    if (!intersection) return;

    // Get camera for position calculation
    const camera = document.querySelector("#cam");

    // Use the optimal coordinate calculation method
    const optimizedPosition = this.calculateOptimalPosition(
      intersection,
      camera
    );

    // Create hotspot data with optimized positioning
    const hotspotData = {
      id: ++this.hotspotIdCounter,
      type: this.selectedHotspotType,
      position: `${optimizedPosition.x.toFixed(
        2
      )} ${optimizedPosition.y.toFixed(2)} ${optimizedPosition.z.toFixed(2)}`,
      label:
        document.getElementById("hotspot-label").value ||
        `Hotspot ${this.hotspotIdCounter}`,
      text: document.getElementById("hotspot-text").value || "",
      audio: this.getSelectedAudioFile(),
      scene: this.currentScene,
      navigationTarget:
        document.getElementById("navigation-target").value || null,
    };

    this.createHotspotElement(hotspotData);
    this.hotspots.push(hotspotData);
    this.scenes[this.currentScene].hotspots.push(hotspotData);
    this.updateHotspotList();
    this.exitEditMode();

    // Clear form fields
    document.getElementById("hotspot-label").value = "";
    document.getElementById("hotspot-text").value = "";
    document.getElementById("hotspot-audio").value = "";
    document.getElementById("hotspot-audio-url").value = "";
    document.getElementById("navigation-target").value = "";
  }

  validateHotspotData() {
    const type = this.selectedHotspotType;
    const textContent = document.getElementById("hotspot-text").value.trim();
    const audioFile = document.getElementById("hotspot-audio").files[0];
    const audioUrl = document.getElementById("hotspot-audio-url").value.trim();
    const label = document.getElementById("hotspot-label").value.trim();
    const navigationTarget = document.getElementById("navigation-target").value;

    switch (type) {
      case "text":
        if (!textContent) {
          return {
            valid: false,
            message: "Text popup type requires text content to be filled.",
          };
        }
        break;

      case "audio":
        if (!audioFile && !audioUrl) {
          return {
            valid: false,
            message:
              "Audio only type requires an audio file or audio URL to be provided.",
          };
        }
        break;

      case "text-audio":
        if (!textContent || (!audioFile && !audioUrl)) {
          return {
            valid: false,
            message:
              "Text + Audio type requires both text content and audio (file or URL).",
          };
        }
        break;

      case "navigation":
        if (!label) {
          return {
            valid: false,
            message: "Navigation hotspots require a label.",
          };
        }
        if (!navigationTarget) {
          return {
            valid: false,
            message: "Navigation hotspots require a target scene.",
          };
        }
        break;
    }

    return { valid: true };
  }

  getSelectedAudioFile() {
    const audioFile = document.getElementById("hotspot-audio").files[0];
    const audioUrl = document.getElementById("hotspot-audio-url").value.trim();

    if (audioUrl) {
      return audioUrl; // Return URL string for online audio
    }
    return audioFile ? audioFile : null; // Return file object for uploaded audio
  }

  createHotspotElement(data) {

    const container = document.getElementById("hotspot-container");
    let hotspotEl;
    if (data.type === "navigation") {
      hotspotEl = document.createElement("a-image");
      hotspotEl.setAttribute("src", "#hotspot");
      hotspotEl.setAttribute("face-camera", "");
    } else {
      // Use a transparent plane for invisible clickable area
      hotspotEl = document.createElement("a-entity");
      hotspotEl.setAttribute("geometry", "primitive: plane; width: 0.7; height: 0.7");
      hotspotEl.setAttribute("material", "opacity: 0; transparent: true");
      // Optionally, add face-camera for consistent interaction
      hotspotEl.setAttribute("face-camera", "");
    }
    hotspotEl.setAttribute("id", `hotspot-${data.id}`);
    hotspotEl.setAttribute("position", data.position);
    hotspotEl.setAttribute("class", "clickable");

    // Create spot component attributes based on type
    let spotConfig = `label:${data.label}`;

    if (data.type === "text" || data.type === "text-audio") {
      spotConfig += `;popup:${data.text};popupWidth:4;popupHeight:2.5;popupColor:#333333`;
    }

    if (data.type === "audio" || data.type === "text-audio") {
      // Use custom audio URL if available, otherwise use default
      let audioSrc = data.audio || "#default-audio";

      // If it's a File object, create a blob URL for the editor
      if (
        data.audio &&
        typeof data.audio === "object" &&
        data.audio instanceof File
      ) {
        audioSrc = URL.createObjectURL(data.audio);
      }

      spotConfig += `;audio:${audioSrc}`;
    }

    if (data.type === "navigation") {
      spotConfig += `;navigation:${data.navigationTarget}`;
    }

    hotspotEl.setAttribute("editor-spot", spotConfig);

    // Add navigation click handler if not in edit mode
    if (data.type === "navigation") {
      hotspotEl.addEventListener("click", (e) => {
        if (!this.navigationMode) return; // Only navigate when not in edit mode
        e.stopPropagation();
        this.navigateToScene(data.navigationTarget);
      });
    }

    container.appendChild(hotspotEl);
  }

  updateHotspotList() {
    const listContainer = document.getElementById("hotspot-list");

    if (this.hotspots.length === 0) {
      listContainer.innerHTML =
        '<div style="color: #888; text-align: center; padding: 20px;">No hotspots created yet</div>';
      return;
    }

    listContainer.innerHTML = "";

    this.hotspots.forEach((hotspot) => {
      const item = document.createElement("div");
      item.className = "hotspot-item";
      item.setAttribute("data-hotspot-id", hotspot.id);

      const typeIcon =
        hotspot.type === "text"
          ? "📝"
          : hotspot.type === "audio"
          ? "🔊"
          : hotspot.type === "text-audio"
          ? "🎵📝"
          : "🚪";

      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div style="flex: 1;">
            <div><strong>${typeIcon} ${hotspot.label}</strong></div>
            <div style="font-size: 12px; color: #ccc;">Type: ${hotspot.type}</div>
            <div style="font-size: 11px; color: #999;">Position: ${hotspot.position}</div>
          </div>
          <div style="display:flex; gap:6px;">
    <button class="edit-hotspot-btn" data-hotspot-id="${hotspot.id}" style="
      background: #6a1b9a; color: white; border: none; border-radius: 6px; width: 28px; height: 28px;
      cursor: pointer; font-size: 14px; display:flex; align-items:center; justify-content:center;"
      title="Edit hotspot">✏️</button>
            <button class="move-hotspot-btn" data-hotspot-id="${hotspot.id}" style="
              background: #1e88e5; color: white; border: none; border-radius: 6px; width: 28px; height: 28px;
              cursor: pointer; font-size: 14px; display:flex; align-items:center; justify-content:center;"
              title="Move hotspot">✎</button>
            <button class="delete-hotspot-btn" data-hotspot-id="${hotspot.id}" style="
              background: #f44336; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px;"
              title="Delete hotspot">✕</button>
          </div>
        </div>
      `;

      // Click to select/highlight hotspot (but not on delete button)
      item.addEventListener("click", (e) => {
        if (!e.target.classList.contains("delete-hotspot-btn")) {
          this.selectHotspot(hotspot.id);
        }
      });

      // Individual delete button
      const deleteBtn = item.querySelector(".delete-hotspot-btn");
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteHotspot(hotspot.id);
      });
      // Edit button
      const editBtn = item.querySelector(".edit-hotspot-btn");
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showEditHotspotDialog(hotspot.id);
      });
      // Move button
      const moveBtn = item.querySelector(".move-hotspot-btn");
      moveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.startReposition(hotspot.id);
      });

      // Hover effect for delete button
      deleteBtn.addEventListener("mouseenter", () => {
        deleteBtn.style.background = "#da190b";
      });

      deleteBtn.addEventListener("mouseleave", () => {
        deleteBtn.style.background = "#f44336";
      });

      listContainer.appendChild(item);
    });
  }

  showEditHotspotDialog(id) {
    const hotspot = this.hotspots.find((h) => h.id === id);
    if (!hotspot) return;

    const isNav = hotspot.type === "navigation";
    const isAudioType =
      hotspot.type === "audio" || hotspot.type === "text-audio";
    const isTextType = hotspot.type === "text" || hotspot.type === "text-audio";

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 10002;
      display: flex; align-items: center; justify-content: center; font-family: Arial;
    `;

    const dialog = document.createElement("div");
    dialog.style.cssText = `background: #2a2a2a; color: white; width: 520px; max-width: 90vw; border-radius: 10px; padding: 20px;`;
    dialog.innerHTML = `
      <h3 style="margin: 0 0 10px; color: #4CAF50;">Edit Hotspot</h3>
      <div style="display:flex; flex-direction: column; gap: 10px;">
        <label style="font-size: 12px; color:#ccc;">Label
          <input id="edit-label" type="text" value="${this._escapeAttr(
            hotspot.label || ""
          )}" style="width:100%; padding:8px; border-radius:6px; border:1px solid #555; background:#1f1f1f; color:#fff;">
        </label>
        ${
          isTextType
            ? `
          <label style="font-size: 12px; color:#ccc;">Description
            <textarea id="edit-text" rows="4" style="width:100%; padding:8px; border-radius:6px; border:1px solid #555; background:#1f1f1f; color:#fff;">${this._escapeHTML(
              hotspot.text || ""
            )}</textarea>
          </label>
        `
            : ""
        }
        ${
          isAudioType
            ? `
          <div>
            <div style="font-size: 12px; color:#ccc; margin-bottom:6px;">Audio</div>
            <input id="edit-audio-file" type="file" accept="audio/*" style="display:block; margin-bottom:6px; color:#ddd;">
            <input id="edit-audio-url" type="url" placeholder="https://example.com/audio.mp3" value="${
              typeof hotspot.audio === "string"
                ? this._escapeAttr(hotspot.audio)
                : ""
            }" style="width:100%; padding:8px; border-radius:6px; border:1px solid #555; background:#1f1f1f; color:#fff;">
            <div style="font-size:11px; color:#999; margin-top:4px;">Choose a file or enter a URL. Leaving both empty removes audio.</div>
          </div>
        `
            : ""
        }
        ${
          isNav
            ? `
          <label style="font-size: 12px; color:#ccc;">Navigation Target
            <select id="edit-nav-target" style="width:100%; padding:8px; border-radius:6px; border:1px solid #555; background:#1f1f1f; color:#fff;"></select>
          </label>
        `
            : ""
        }
        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top: 10px;">
          <button id="edit-cancel" style="background:#666; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">Cancel</button>
          <button id="edit-save" style="background:#4CAF50; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">Save</button>
        </div>
      </div>
    `;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Wire up audio coordination inside dialog
    const fileInput = dialog.querySelector("#edit-audio-file");
    const urlInput = dialog.querySelector("#edit-audio-url");
    if (fileInput && urlInput) {
      fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) urlInput.value = "";
      });
      urlInput.addEventListener("input", () => {
        if (urlInput.value.trim()) fileInput.value = "";
      });
    }

    // Populate navigation targets if needed
    if (isNav) {
      const sel = dialog.querySelector("#edit-nav-target");
      if (sel) {
        sel.innerHTML = "";
        Object.keys(this.scenes).forEach((sceneId) => {
          if (sceneId !== this.currentScene) {
            const opt = document.createElement("option");
            opt.value = sceneId;
            opt.textContent = this.scenes[sceneId].name;
            if (sceneId === (hotspot.navigationTarget || ""))
              opt.selected = true;
            sel.appendChild(opt);
          }
        });
      }
    }

    const close = () => {
      if (overlay && overlay.parentNode)
        overlay.parentNode.removeChild(overlay);
    };
    dialog.querySelector("#edit-cancel").onclick = close;

    dialog.querySelector("#edit-save").onclick = () => {
      // Collect values
      const newLabel = (
        dialog.querySelector("#edit-label")?.value || ""
      ).trim();
      const newText = isTextType
        ? (dialog.querySelector("#edit-text")?.value || "").trim()
        : hotspot.text;
      let newAudio = hotspot.audio;
      if (isAudioType) {
        const f = dialog.querySelector("#edit-audio-file");
        const u = dialog.querySelector("#edit-audio-url");
        const file = f && f.files ? f.files[0] : null;
        const url = u ? u.value.trim() : "";
        if (url) newAudio = url;
        else if (file) newAudio = file;
        else newAudio = null;
      }
      const newNavTarget = isNav
        ? dialog.querySelector("#edit-nav-target")?.value || ""
        : hotspot.navigationTarget;

      // Validate
      const v = this._validateHotspotValues(hotspot.type, {
        label: newLabel,
        text: newText,
        audio: newAudio,
        navigationTarget: newNavTarget,
      });
      if (!v.valid) {
        alert(v.message);
        return;
      }

      // Apply to data structures
      hotspot.label = newLabel || hotspot.label; // keep existing if blank
      if (isTextType) hotspot.text = newText;
      if (isAudioType) hotspot.audio = newAudio;
      if (isNav) hotspot.navigationTarget = newNavTarget;

      // Update scene-specific copy
      const sceneHotspot = (this.scenes[this.currentScene].hotspots || []).find(
        (h) => h.id === id
      );
      if (sceneHotspot) {
        sceneHotspot.label = hotspot.label;
        if (isTextType) sceneHotspot.text = hotspot.text;
        if (isAudioType) sceneHotspot.audio = hotspot.audio;
        if (isNav) sceneHotspot.navigationTarget = hotspot.navigationTarget;
      }

      // Rebuild entity for simplicity
      this._refreshHotspotEntity(hotspot);
      this.updateHotspotList();
      close();
      this.showStartingPointFeedback("Hotspot updated");
    };
  }

  _validateHotspotValues(type, { label, text, audio, navigationTarget }) {
    switch (type) {
      case "text":
        if (!text)
          return {
            valid: false,
            message: "Text popup type requires description text.",
          };
        return { valid: true };
      case "audio":
        if (!audio)
          return {
            valid: false,
            message: "Audio-only hotspot requires an audio file or URL.",
          };
        return { valid: true };
      case "text-audio":
        if (!text || !audio)
          return {
            valid: false,
            message: "Text + Audio hotspot requires both text and audio.",
          };
        return { valid: true };
      case "navigation":
        if (!label)
          return {
            valid: false,
            message: "Navigation hotspot requires a label.",
          };
        if (!navigationTarget)
          return {
            valid: false,
            message: "Please choose a navigation target.",
          };
        return { valid: true };
      default:
        return { valid: true };
    }
  }

  _refreshHotspotEntity(hotspot) {
    const el = document.getElementById(`hotspot-${hotspot.id}`);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    // Ensure position persists
    const dataCopy = { ...hotspot };
    this.createHotspotElement(dataCopy);
  }

  _escapeAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  _escapeHTML(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }

  startReposition(id) {
    this.repositioningHotspotId = id;
    this.showRepositionNotice();
    this._setHotspotTranslucent(id, true);
  }

  showRepositionNotice() {
    // Simple inline notice under instructions
    const existing = document.getElementById("reposition-notice");
    if (existing) return;
    const n = document.createElement("div");
    n.id = "reposition-notice";
    n.style.cssText =
      "position:fixed; top:20px; right:380px; background: rgba(33,150,243,0.95); color:white; padding:8px 12px; border-radius:6px; z-index:10001; font-family:Arial; font-size:12px;";
    n.textContent =
      "Reposition mode: click on the 360° image to set new position • Press ESC to cancel";
    document.body.appendChild(n);
    // esc to cancel
    this._escCancelReposition = (e) => {
      if (e.key === "Escape") this.cancelReposition();
    };
    window.addEventListener("keydown", this._escCancelReposition);
  }

  hideRepositionNotice() {
    const n = document.getElementById("reposition-notice");
    if (n && n.parentNode) n.parentNode.removeChild(n);
    if (this._escCancelReposition) {
      window.removeEventListener("keydown", this._escCancelReposition);
      this._escCancelReposition = null;
    }
  }

  applyReposition(evt) {
    const id = this.repositioningHotspotId;
    if (!id) return;
    const hotspot = this.hotspots.find((h) => h.id === id);
    if (!hotspot) {
      this.cancelReposition();
      return;
    }

    const intersection = evt.detail.intersection;
    if (!intersection) return;
    const camera = document.querySelector("#cam");
    const pos = this.calculateOptimalPosition(intersection, camera);
    const newPos = `${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(
      2
    )}`;

    // Update data
    hotspot.position = newPos;
    const sceneHotspot = (this.scenes[this.currentScene].hotspots || []).find(
      (h) => h.id === id
    );
    if (sceneHotspot) sceneHotspot.position = newPos;

    // Update entity
    const el = document.getElementById(`hotspot-${id}`);
    if (el) el.setAttribute("position", newPos);

    this._setHotspotTranslucent(id, false);
    this.repositioningHotspotId = null;
    this.hideRepositionNotice();
    this.updateHotspotList();
    this.showStartingPointFeedback("Hotspot moved");
  }

  cancelReposition() {
    if (this.repositioningHotspotId) {
      this._setHotspotTranslucent(this.repositioningHotspotId, false);
    }
    this.repositioningHotspotId = null;
    this.hideRepositionNotice();
  }

  _setHotspotTranslucent(id, on) {
    const el = document.getElementById(`hotspot-${id}`);
    if (!el) return;
    try {
      const current = el.getAttribute("material") || {};
      if (on) {
        // stash previous material to restore later
        this._repositionPrevMaterial = { id, material: { ...current } };
        el.setAttribute("material", {
          ...current,
          transparent: true,
          opacity: 0.55,
        });
        // subtle pulse to draw attention
        el.setAttribute("animation__pulse", {
          property: "scale",
          from: "1 1 1",
          to: "1.1 1.1 1.1",
          dur: 600,
          dir: "alternate",
          loop: true,
          easing: "easeInOutSine",
        });
      } else {
        // restore material
        if (
          this._repositionPrevMaterial &&
          this._repositionPrevMaterial.id === id
        ) {
          el.setAttribute(
            "material",
            this._repositionPrevMaterial.material || {
              transparent: false,
              opacity: 1,
            }
          );
        } else {
          el.setAttribute("material", { transparent: false, opacity: 1 });
        }
        el.removeAttribute("animation__pulse");
      }
    } catch (e) {
      if (!on) {
        el.setAttribute("material", { transparent: false, opacity: 1 });
        el.removeAttribute("animation__pulse");
      }
    }
  }

  selectHotspot(id) {
    // Remove previous selection
    document.querySelectorAll(".hotspot-item").forEach((item) => {
      item.classList.remove("selected");
    });

    // Add selection to current item
    const item = document.querySelector(`[data-hotspot-id="${id}"]`);
    if (item) {
      item.classList.add("selected");
      this.selectedHotspotId = id;

      // Highlight the hotspot in the scene
      const hotspotEl = document.getElementById(`hotspot-${id}`);
      if (hotspotEl) {
        // Add a temporary highlight effect
        hotspotEl.emit("highlight");
      }
    }
  }

  deleteHotspot(id) {
    const hotspot = this.hotspots.find((h) => h.id === id);
    if (!hotspot) return;

    if (confirm(`Delete hotspot "${hotspot.label}"?`)) {
      // Remove from array
      this.hotspots = this.hotspots.filter((h) => h.id !== id);

      // Remove from scene
      const hotspotEl = document.getElementById(`hotspot-${id}`);
      if (hotspotEl) {
        hotspotEl.remove();
      }

      this.updateHotspotList();
    }
  }

  clearAllHotspots() {
    if (this.hotspots.length === 0) return;

    if (confirm("Clear all hotspots?")) {
      this.hotspots.forEach((hotspot) => {
        const hotspotEl = document.getElementById(`hotspot-${hotspot.id}`);
        if (hotspotEl) {
          hotspotEl.remove();
        }
      });

      this.hotspots = [];
      this.updateHotspotList();
    }
  }

  async saveTemplate() {
    const templateName =
      document.getElementById("template-name").value ||
      `hotspot-project-${Date.now()}`;

    // Show options dialog
    const exportType = await this.showExportDialog();

    if (exportType === "json") {
      this.saveAsJSON(templateName);
    } else if (exportType === "project") {
      this.saveAsCompleteProject(templateName);
    }
  }

  showExportDialog() {
    return new Promise((resolve) => {
      const dialog = document.createElement("div");
      dialog.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
        align-items: center; justify-content: center; font-family: Arial;
      `;

      dialog.innerHTML = `
        <div style="background: #2a2a2a; padding: 30px; border-radius: 10px; color: white; max-width: 500px;">
          <h3 style="margin-top: 0; color: #4CAF50;">Export Options</h3>
          <p>Choose how you want to save your hotspot project:</p>
          
          <div style="margin: 20px 0;">
            <button id="export-json" style="
              background: #4CAF50; color: white; border: none; padding: 15px 25px;
              border-radius: 6px; cursor: pointer; margin: 5px; width: 200px;
              font-size: 14px; font-weight: bold;
            ">📄 JSON Template</button>
            <div style="font-size: 12px; color: #ccc; margin-left: 5px;">
              Save configuration only (requires existing project files)
            </div>
          </div>
          
          <div style="margin: 20px 0;">
            <button id="export-project" style="
              background: #2196F3; color: white; border: none; padding: 15px 25px;
              border-radius: 6px; cursor: pointer; margin: 5px; width: 200px;
              font-size: 14px; font-weight: bold;
            ">📦 Complete Project</button>
            <div style="font-size: 12px; color: #ccc; margin-left: 5px;">
              Save everything as standalone project folder
            </div>
          </div>
          
          <button id="export-cancel" style="
            background: #666; color: white; border: none; padding: 10px 20px;
            border-radius: 4px; cursor: pointer; margin-top: 10px;
          ">Cancel</button>
        </div>
      `;

      document.body.appendChild(dialog);

      document.getElementById("export-json").onclick = () => {
        document.body.removeChild(dialog);
        resolve("json");
      };

      document.getElementById("export-project").onclick = () => {
        document.body.removeChild(dialog);
        resolve("project");
      };

      document.getElementById("export-cancel").onclick = () => {
        document.body.removeChild(dialog);
        resolve(null);
      };
    });
  }

  saveAsJSON(templateName) {
    const template = {
      name: templateName,
      created: new Date().toISOString(),
      scenes: this.scenes, // Save all scenes instead of just hotspots
      currentScene: this.currentScene,
      hotspots: this.hotspots, // Keep for backwards compatibility
    };

    // Create download link
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(template, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${templateName}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    alert(`JSON template "${templateName}" saved!`);
  }

  async saveAsCompleteProject(templateName) {
    try {
      // Show progress
      const progressDiv = this.showProgress("Creating complete project...");

      // Create JSZip instance
      const JSZip = window.JSZip || (await this.loadJSZip());
      const zip = new JSZip();

      // Get current skybox image - handle both data URLs and file paths
      const skyboxImg = document.querySelector("#main-panorama");
      const skyboxSrc = skyboxImg ? skyboxImg.src : "";

      // Create project structure with all scenes
      await this.addFilesToZip(zip, templateName, skyboxSrc);

      // Generate and download ZIP
      const content = await zip.generateAsync({ type: "blob" });
      this.downloadBlob(content, `${templateName}.zip`);

      this.hideProgress(progressDiv);
      alert(
        `Complete project "${templateName}.zip" created! Extract and open index.html to run.`
      );
    } catch (error) {
      alert(`Error creating project: ${error.message}`);
    }
  }

  async loadJSZip() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => reject(new Error("Failed to load JSZip"));
      document.head.appendChild(script);
    });
  }

  async addFilesToZip(zip, templateName, skyboxSrc) {
    // Add main HTML file
    const htmlContent = this.generateCompleteHTML(templateName);
    zip.file("index.html", htmlContent);

    // Add JavaScript file
    const jsContent = this.generateCompleteJS();
    zip.file("script.js", jsContent);

    // Add CSS file
    const cssContent = this.generateCSS();
    zip.file("style.css", cssContent);

    // Create folders
    const imagesFolder = zip.folder("images");
    const audioFolder = zip.folder("audio");

    // Add real assets from current project
    await this.addRealAssets(imagesFolder, audioFolder);

    // Add all scene images
    await this.addSceneImages(imagesFolder);

    // Add configuration with all scenes and hotspots (with corrected image/audio paths)
    const scenes = await this.normalizeScenePathsForExport(audioFolder);
    const config = {
      name: templateName,
      created: new Date().toISOString(),
      scenes,
      currentScene: this.currentScene,
      version: "1.0",
    };
    zip.file("config.json", JSON.stringify(config, null, 2));

    // Add README
    const readmeContent = `# VR Hotspot Project: ${templateName}

## How to Use
1. Open index.html in a web browser
2. Click on hotspots to interact with content
3. Use mouse to look around the 360° environment
4. Compatible with VR headsets

## Files Structure
- index.html - Main project file
- script.js - Project functionality
- style.css - Styling
- config.json - Project configuration with all scenes
- images/ - Image assets including scene panoramas
- audio/ - Audio assets

## Requirements
- Modern web browser
- Internet connection (for A-Frame library)

Generated by VR Hotspot Editor on ${new Date().toLocaleDateString()}
`;
    zip.file("README.md", readmeContent);
  }

  async addSceneImages(imagesFolder) {
    for (const [sceneId, scene] of Object.entries(this.scenes)) {
      if (scene.image.startsWith("data:")) {
        // Convert data URL to blob
        const response = await fetch(scene.image);
        const blob = await response.blob();
        imagesFolder.file(`${sceneId}.jpg`, blob);
      } else if (scene.image.startsWith("./images/")) {
        // Copy existing image files
        try {
          const response = await fetch(scene.image);
          if (response.ok) {
            const blob = await response.blob();
            const filename = scene.image.split("/").pop();
            imagesFolder.file(filename, blob);
          }
        } catch (e) {
          console.warn(`Could not copy scene image: ${scene.image}`);
        }
      }
    }
  }

  async normalizeScenePathsForExport(audioFolder) {
    const normalizedScenes = {};

    for (const [sceneId, scene] of Object.entries(this.scenes)) {
      // Create new scene object without deep copying to preserve File objects
      const newScene = {
        name: scene.name,
        image: this.getExportImagePath(scene.image, sceneId),
        hotspots: [],
        startingPoint: scene.startingPoint,
      };

      // Process each hotspot, handling File objects properly
      if (Array.isArray(scene.hotspots)) {
        for (const origHotspot of scene.hotspots) {
          const newHotspot = {
            id: origHotspot.id,
            type: origHotspot.type,
            position: origHotspot.position,
            label: origHotspot.label,
            text: origHotspot.text,
            scene: origHotspot.scene,
            navigationTarget: origHotspot.navigationTarget,
            audio: null,
          };

          // Handle audio properly
          if (origHotspot.audio && origHotspot.audio instanceof File) {
            // It's a File object, save to audio folder and update path
            const fileName = `${sceneId}_${origHotspot.id}_${origHotspot.audio.name}`;
            if (audioFolder) {
              audioFolder.file(fileName, origHotspot.audio);
            }
            newHotspot.audio = `./audio/${fileName}`;
          } else if (typeof origHotspot.audio === "string") {
            // It's a URL string, keep as-is
            newHotspot.audio = origHotspot.audio;
          } else {
            // null or undefined
            newHotspot.audio = null;
          }

          newScene.hotspots.push(newHotspot);
        }
      }

      normalizedScenes[sceneId] = newScene;
    }
    return normalizedScenes;
  }

  getExportImagePath(imagePath, sceneId) {
    // If it's a URL (http:// or https://), use it directly
    if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
      return imagePath;
    }
    // For uploaded scenes (data URLs), save as sceneId.jpg
    else if (imagePath.startsWith("data:")) {
      return `./images/${sceneId}.jpg`;
    }
    // If it's already a proper path starting with ./images/, keep as-is
    else if (imagePath.startsWith("./images/")) {
      return imagePath;
    }
    // Fallback - assume it's a filename and prepend the images path
    else {
      return `./images/${imagePath}`;
    }
  }

  loadTemplate() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.zip";

    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.name.endsWith(".json")) {
        this.loadJSONTemplate(file);
      } else if (file.name.endsWith(".zip")) {
        alert(
          "ZIP project loading will extract to your downloads. Open the index.html file from the extracted folder."
        );
        // For ZIP files, user needs to extract manually and open index.html
        // This is the simplest approach for now
      } else {
        alert("Please select a JSON template file or ZIP project file.");
      }
    });

    input.click();
  }

  loadJSONTemplate(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const template = JSON.parse(e.target.result);
        this.clearAllHotspots();

        // Handle new format with scenes
        if (template.scenes) {
          this.scenes = template.scenes;
          this.currentScene = template.currentScene || "room1";
          this.updateSceneDropdown();
          this.loadCurrentScene();
        }
        // Handle legacy format
        else if (template.hotspots) {
          template.hotspots.forEach((hotspotData) => {
            this.createHotspotElement(hotspotData);
            this.hotspots.push(hotspotData);
          });
          this.hotspotIdCounter = Math.max(
            ...this.hotspots.map((h) => h.id),
            0
          );
        }

        this.updateHotspotList();
        this.updateNavigationTargets();
        this.updateStartingPointInfo();

        alert(`Template "${template.name}" loaded successfully!`);
      } catch (error) {
        alert("Error loading template file");
      }
    };
    reader.readAsText(file);
  }

  // Project export helper methods
  showProgress(message) {
    const progressDiv = document.createElement("div");
    progressDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.9); color: white; padding: 20px;
      border-radius: 8px; z-index: 10001; font-family: Arial;
    `;
    progressDiv.innerHTML = `<div style="text-align: center;">${message}<br><div style="margin-top: 10px;">⏳ Please wait...</div></div>`;
    document.body.appendChild(progressDiv);
    return progressDiv;
  }

  hideProgress(progressDiv) {
    if (progressDiv && progressDiv.parentNode) {
      progressDiv.parentNode.removeChild(progressDiv);
    }
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  generateCompleteHTML(templateName) {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${templateName} - VR Hotspot Experience</title>
    <meta name="description" content="Interactive VR Hotspot Experience" />
    <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
    <script src="https://cdn.jsdelivr.net/gh/c-frame/aframe-extras@7.5.4/dist/aframe-extras.min.js"></script>
    <script src="script.js"></script>
    <link rel="stylesheet" href="style.css">
  </head>
  
  <body>
    <div id="project-info">
      <h1>${templateName}</h1>
      <p>Interactive VR Experience • Click on hotspots to explore</p>
    </div>

    <a-scene background="color: #ECECEC" id="main-scene">
      <a-entity
        laser-controls="hand: right"
        raycaster="objects: .clickable, .audio-control"
      ></a-entity>
      <a-entity
        laser-controls="hand: left"
        raycaster="objects: .clickable, .audio-control"
      ></a-entity>

      <a-assets>
        <img id="main-panorama" src="./images/room1.jpg" />
        <img id="hotspot" src="./images/up-arrow.png" />
        <audio id="default-audio" src="./audio/music.mp3"></audio>
        <img id="close" src="./images/close.png" />
        <img id="play" src="./images/play.png" />
        <img id="pause" src="./images/pause.png" />
      </a-assets>

      <a-entity id="hotspot-container"></a-entity>
      <a-sky id="skybox" src="#main-panorama"></a-sky>

      <a-entity id="cam" camera position="0 1.6 0" look-controls>
        <a-entity
          id="cursor"
          cursor="rayOrigin: mouse; fuse: false"
          raycaster="objects: .clickable, .audio-control"
          position="0 0 -1.8"
          material="shader: flat; color: #ff0000; opacity: 0.8"
          geometry="primitive: ring; radiusInner: 0.005; radiusOuter: 0.01"
        ></a-entity>
      </a-entity>
    </a-scene>
  </body>
</html>`;
  }

  generateCSS() {
    return `/* VR Hotspot Project Styles */
body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #000;
}

#project-info {
  position: fixed;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  border-radius: 8px;
  z-index: 999;
  max-width: 300px;
}

#project-info h1 {
  margin: 0 0 5px 0;
  font-size: 18px;
  color: #4CAF50;
}

#project-info p {
  margin: 0;
  font-size: 12px;
  color: #ccc;
}

/* Hotspot animations */
.clickable {
  cursor: pointer;
}

/* Navigation feedback animation */
@keyframes fadeInOut {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
}

/* Responsive design */
@media (max-width: 768px) {
  #project-info {
    position: static;
    margin: 10px;
  }
}`;
  }

  generateCompleteJS() {
    return `// VR Hotspot Project - Standalone Version
// Generated from VR Hotspot Editor

// Face camera component
AFRAME.registerComponent("face-camera", {
  init: function () {
    this.cameraObj = document.querySelector("[camera]").object3D;
  },
  tick: function () {
    if (this.cameraObj) {
      this.el.object3D.lookAt(this.cameraObj.position);
    }
  },
});

// Hotspot component for standalone projects
AFRAME.registerComponent("hotspot", {
  schema: {
    label: { type: "string", default: "" },
    audio: { type: "string", default: "" },
    popup: { type: "string", default: "" },
    popupWidth: { type: "number", default: 3 },
    popupHeight: { type: "number", default: 2 },
    popupColor: { type: "color", default: "#333333" },
  },

  init: function () {
    const data = this.data;
    const el = this.el;

    // Add hover animations
    el.setAttribute("animation__hover_in", {
      property: "scale",
      to: "1.2 1.2 1.2",
      dur: 200,
      easing: "easeOutQuad",
      startEvents: "mouseenter",
    });

    el.setAttribute("animation__hover_out", {
      property: "scale",
      to: "1 1 1",
      dur: 200,
      easing: "easeOutQuad",
      startEvents: "mouseleave",
    });

    // Add popup functionality
    if (data.popup) {
      this.createPopup(data);
    }

    // Add label
    if (data.label) {
      this.createLabel(data);
    }

    // Add audio functionality
    if (data.audio) {
      this.createAudio(data);
    }
  },

  createPopup: function(data) {
    const el = this.el;

    const infoIcon = document.createElement("a-entity");
    infoIcon.setAttribute("geometry", "primitive: plane; width: 4; height: 0.5");
    infoIcon.setAttribute("material", "color: #00FF00");
    infoIcon.setAttribute("text", "value: click for info; align: center; color: black; width: 8");
    infoIcon.setAttribute("position", "0 1 0");
    infoIcon.classList.add("clickable");
    el.appendChild(infoIcon);

    const popup = document.createElement("a-entity");
    popup.setAttribute("visible", "false");
    popup.setAttribute("position", "0 1.5 0");
    popup.setAttribute("look-at", "#cam");

    const background = document.createElement("a-plane");
    background.setAttribute("color", data.popupColor);
    background.setAttribute("width", data.popupWidth);
    background.setAttribute("height", data.popupHeight);
    background.setAttribute("opacity", 0.95);
    popup.appendChild(background);

    const text = document.createElement("a-text");
    text.setAttribute("value", data.popup);
    text.setAttribute("wrap-count", 35);
    text.setAttribute("color", "white");
    text.setAttribute("position", "0 0 0.01");
    text.setAttribute("align", "center");
    popup.appendChild(text);

    const closeButton = document.createElement("a-image");
    closeButton.setAttribute("position", data.popupWidth/2-0.3 + " " + (data.popupHeight/2-0.3) + " 0.02");
    closeButton.setAttribute("src", "#close");
    closeButton.setAttribute("width", "0.4");
    closeButton.setAttribute("height", "0.4");
    closeButton.classList.add("clickable");
    popup.appendChild(closeButton);

    infoIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      popup.setAttribute("visible", true);
      infoIcon.setAttribute("visible", false); // Hide info icon when popup is open
    });

    closeButton.addEventListener("click", (e) => {
      e.stopPropagation();
      popup.setAttribute("visible", false);
      setTimeout(() => {
        infoIcon.setAttribute("visible", true); // Show info icon when popup is closed
      }, 250);
    });

    el.appendChild(popup);
  },

  createLabel: function(data) {
    const el = this.el;
    const labelContainer = document.createElement("a-entity");
    labelContainer.setAttribute("position", "0 -0.6 0");

    const bg = document.createElement("a-plane");
    bg.setAttribute("color", "#333333");
    bg.setAttribute("opacity", 0.8);
    bg.setAttribute("width", data.label.length * 0.15 + 0.4);
    bg.setAttribute("height", 0.3);

    const textEl = document.createElement("a-text");
    textEl.setAttribute("value", data.label);
    textEl.setAttribute("align", "center");
    textEl.setAttribute("color", "#FFFFFF");

    labelContainer.appendChild(bg);
    labelContainer.appendChild(textEl);
    el.appendChild(labelContainer);
  },

  createAudio: function(data) {
    const el = this.el;
    const audioEl = document.createElement("a-sound");
    audioEl.setAttribute("src", data.audio);
    audioEl.setAttribute("autoplay", "false");
    audioEl.setAttribute("loop", "true");
    el.appendChild(audioEl);

    const btn = document.createElement("a-image");
    btn.setAttribute("class", "clickable");
    btn.setAttribute("src", "#play");
    btn.setAttribute("width", "0.5");
    btn.setAttribute("height", "0.5");
    btn.setAttribute("position", "0 -1 0.02");
    el.appendChild(btn);

    let isPlaying = false;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (audioEl.components.sound) {
        if (isPlaying) {
          audioEl.components.sound.stopSound();
          btn.setAttribute("src", "#play");
        } else {
          audioEl.components.sound.playSound();
          btn.setAttribute("src", "#pause");
        }
        isPlaying = !isPlaying;
      }
    });
  }
});

// Project loader
// Project loader
class HotspotProject {
  constructor() {
    this.scenes = {};
    this.currentScene = 'room1';
    this.loadProject();
  }

  async loadProject() {
    try {
      const response = await fetch('./config.json');
      const config = await response.json();
      
      console.log('Loaded config:', config);
      
      if (config.scenes) {
        // New format with scenes
        this.scenes = config.scenes;
        this.currentScene = config.currentScene || 'room1';
        console.log('Using new format with scenes:', this.scenes);
        this.setupScenes();
      } else if (config.hotspots) {
        // Legacy format - single scene
        this.scenes = {
          'room1': {
            name: 'Room 1',
            image: './images/room1.jpg',
            hotspots: config.hotspots
          }
        };
        this.currentScene = 'room1';
        console.log('Using legacy format, created single scene');
        this.setupScenes();
      }
    } catch (error) {
      console.warn('No config.json found, using empty project');
      this.scenes = {
        'room1': {
          name: 'Room 1', 
          image: './images/room1.jpg',
          hotspots: []
        }
      };
      this.setupScenes();
    }
  }

  setupScenes() {
    // Load the current scene
    this.loadScene(this.currentScene);
  }

  loadScene(sceneId) {
    if (!this.scenes[sceneId]) {
      console.warn(\`Scene \${sceneId} not found\`);
      return;
    }
    
    const scene = this.scenes[sceneId];
    const skybox = document.getElementById('skybox');
    
    console.log(\`Loading scene: \${sceneId}\`, scene);
    
    // Show a loading indicator
    this.showLoadingIndicator();
    
    // Update scene image
    const imagePath = this.getSceneImagePath(scene.image, sceneId);
    console.log(\`Setting panorama src to: \${imagePath}\`);
    
    // Use a timestamp as a cache buster
    const cacheBuster = Date.now();
    const imagePathWithCache = imagePath + '?t=' + cacheBuster;
    
    // Create a new unique ID for this panorama
    const uniqueId = 'panorama-' + cacheBuster;
    
    // Create a completely new method that's more reliable across browsers
    // First, create a new image element that's not attached to the DOM yet
    const preloadImage = new Image();
    
    // Set up loading handlers before setting src
    preloadImage.onload = () => {
      console.log('New panorama loaded successfully');
      
      // Now we know the image is loaded, create the actual element for A-Frame
      const newPanorama = document.createElement('img');
      newPanorama.id = uniqueId;
      newPanorama.src = imagePathWithCache;
      newPanorama.crossOrigin = 'anonymous'; // Important for some browsers
      
      // Get the assets container
      const assets = document.querySelector('a-assets');
      
      // Add new panorama element to assets
      assets.appendChild(newPanorama);
      
      // Temporarily hide the skybox while changing its texture
      skybox.setAttribute('visible', 'false');
      
      // Force A-Frame to recognize the asset change
      setTimeout(() => {
        // Update to new texture
        skybox.setAttribute('src', '#' + uniqueId);
        skybox.setAttribute('visible', 'true');
        
        console.log('Skybox texture updated with ID:', uniqueId);
        
        // Create hotspots after skybox is updated
        const container = document.getElementById('hotspot-container');
        container.innerHTML = '';
        this.createHotspots(scene.hotspots);
        console.log('Hotspots created');
        
        // Apply starting point if available
        setTimeout(() => {
          this.applyStartingPoint(scene);
        }, 100);
        
        // Hide the loading indicator
        this.hideLoadingIndicator();
      }, 100);
    };
    
    // Handle load errors
    preloadImage.onerror = () => {
      console.error(\`Failed to load panorama: \${imagePath}\`);
      this.showErrorMessage(\`Failed to load scene image for "\${scene.name}". Please check if the image exists at \${imagePath}\`);
      this.hideLoadingIndicator();
    };
    
    // Start loading the image
    preloadImage.src = imagePathWithCache;
    
    // We've replaced this with the preloadImage.onerror handler above
    
    this.currentScene = sceneId;
  }

  getSceneImagePath(imagePath, sceneId) {
    // If it's a URL (http:// or https://), use it directly
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // If it's already a proper path starting with ./images/, use it directly
    else if (imagePath.startsWith('./images/')) {
      return imagePath;
    } 
    // For uploaded scenes (data URLs in config), look for the saved file
    else if (imagePath.startsWith('data:')) {
      return \`./images/\${sceneId}.jpg\`;
    }
    // Fallback - assume it's a filename and prepend the images path
    else {
      return \`./images/\${imagePath}\`;
    }
  }

  createHotspots(hotspots) {
    const container = document.getElementById('hotspot-container');
    

    hotspots.forEach(hotspot => {
      let hotspotEl;
      if (hotspot.type === 'navigation') {
        hotspotEl = document.createElement('a-image');
        hotspotEl.setAttribute('src', '#hotspot');
        hotspotEl.setAttribute('face-camera', '');
      } else {
        hotspotEl = document.createElement('a-entity');
        hotspotEl.setAttribute('geometry', 'primitive: plane; width: 0.7; height: 0.7');
        hotspotEl.setAttribute('material', 'opacity: 0; transparent: true');
        hotspotEl.setAttribute('face-camera', '');
      }
      hotspotEl.setAttribute('position', hotspot.position);
      hotspotEl.setAttribute('class', 'clickable');
      
      let config = "label:" + hotspot.label;
      
      if (hotspot.type === 'text' || hotspot.type === 'text-audio') {
        config += ";popup:" + hotspot.text + ";popupWidth:4;popupHeight:2.5;popupColor:#333333";
      }
      
      if (hotspot.type === 'audio' || hotspot.type === 'text-audio') {
        // Use custom audio URL if available, otherwise use default
        const audioSrc = hotspot.audio || "#default-audio";
        config += ";audio:" + audioSrc;
      }
      
      if (hotspot.type === 'navigation') {
        config += ";navigation:" + hotspot.navigationTarget;
        
        // Add navigation click handler
        hotspotEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.navigateToScene(hotspot.navigationTarget);
        });
        
        // Add visual effects for navigation hotspots
        hotspotEl.setAttribute('material', 'color: #2196F3');
        hotspotEl.setAttribute('animation__rotate', {
          property: 'rotation',
          to: '0 360 0',
          dur: 4000,
          easing: 'linear',
          loop: true
        });
      }
      
      hotspotEl.setAttribute('hotspot', config);
      container.appendChild(hotspotEl);
    });
  }
  
  navigateToScene(sceneId) {
    if (!this.scenes[sceneId]) {
      console.warn(\`Scene \${sceneId} not found\`);
      return;
    }
    
    // Show navigation feedback before loading the scene
    this.showNavigationFeedback(this.scenes[sceneId].name);
    
    // Short delay to allow the feedback to be visible before potential loading screen
    setTimeout(() => {
      this.loadScene(sceneId);
    }, 300);
  }
  
  showNavigationFeedback(sceneName) {
    const feedback = document.createElement('div');
    feedback.style.cssText = \`
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(76, 175, 80, 0.9); color: white; padding: 15px 25px;
      border-radius: 8px; font-weight: bold; z-index: 10001;
      font-family: Arial; animation: fadeInOut 2s ease-in-out;
    \`;
    feedback.innerHTML = \`Navigated to: \${sceneName}\`;
    
    document.body.appendChild(feedback);
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 2000);
  }
  
  showErrorMessage(message) {
    const errorBox = document.createElement("div");
    errorBox.style.cssText = \`
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(244, 67, 54, 0.9); color: white; padding: 20px 30px;
      border-radius: 8px; font-weight: bold; z-index: 10001;
      font-family: Arial; max-width: 80%;
    \`;
    errorBox.innerHTML = \`<div style="text-align:center">⚠️ Error</div><div style="margin-top:10px">\${message}</div>\`;
    
    // Add a close button
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "Close";
    closeBtn.style.cssText = \`
      background: white; color: #f44336; border: none; padding: 8px 15px;
      border-radius: 4px; margin-top: 15px; cursor: pointer; font-weight: bold;
      display: block; margin-left: auto; margin-right: auto;
    \`;
    
    closeBtn.onclick = () => {
      if (errorBox.parentNode) {
        errorBox.parentNode.removeChild(errorBox);
      }
    };
    
    errorBox.appendChild(closeBtn);
    document.body.appendChild(errorBox);
  }
  
  showLoadingIndicator() {
    // Remove any existing loading indicator
    this.hideLoadingIndicator();
    
    // Create loading indicator
    const loadingEl = document.createElement('div');
    loadingEl.id = 'scene-loading-indicator';
    loadingEl.style.cssText = \`
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 20px 40px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 18px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    \`;
    
    // Add spinning animation
    const spinner = document.createElement('div');
    spinner.style.cssText = \`
      border: 5px solid rgba(255, 255, 255, 0.3);
      border-top: 5px solid #fff;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      margin-bottom: 15px;
      animation: spin 1s linear infinite;
    \`;
    
    // Add keyframes for spinner animation
    const style = document.createElement('style');
    style.textContent = \`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    \`;
    document.head.appendChild(style);
    
    // Text
    const text = document.createElement('div');
    text.textContent = 'Loading scene...';
    
    loadingEl.appendChild(spinner);
    loadingEl.appendChild(text);
    document.body.appendChild(loadingEl);
  }
  
  hideLoadingIndicator() {
    const loadingEl = document.getElementById('scene-loading-indicator');
    if (loadingEl && loadingEl.parentNode) {
      loadingEl.parentNode.removeChild(loadingEl);
    }
  }
  
  applyStartingPoint(scene) {
    if (!scene.startingPoint || !scene.startingPoint.rotation) return;
    
    const camera = document.getElementById('cam');
    const rotation = scene.startingPoint.rotation;
    
    // Temporarily disable look-controls to allow rotation setting
    const lookControls = camera.components['look-controls'];
    if (lookControls) {
      lookControls.pause();
    }
    
    // Apply the stored rotation to the camera
    camera.setAttribute('rotation', \`\${rotation.x} \${rotation.y} \${rotation.z}\`);
    
    // Force the look-controls to sync with the new rotation
    if (lookControls) {
      // Update the look-controls internal state to match our rotation
      lookControls.pitchObject.rotation.x = THREE.MathUtils.degToRad(rotation.x);
      lookControls.yawObject.rotation.y = THREE.MathUtils.degToRad(rotation.y);
      
      // Re-enable look-controls after a short delay
      setTimeout(() => {
        lookControls.play();
      }, 100);
    }
    
    console.log(\`Applied starting point rotation: X:\${rotation.x}° Y:\${rotation.y}° Z:\${rotation.z}°\`);
  }
}

// Initialize project
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    new HotspotProject();
  }, 1000);
});`;
  }

  async addRealAssets(imagesFolder, audioFolder) {
    try {
      // Fetch real assets from the current project
      const assetsToFetch = [
        { path: "./images/up-arrow.png", filename: "up-arrow.png" },
        { path: "./images/close.png", filename: "close.png" },
        { path: "./images/play.png", filename: "play.png" },
        { path: "./images/pause.png", filename: "pause.png" },
        { path: "./images/room1.jpg", filename: "room1.jpg" }, // Default panorama
      ];

      for (const asset of assetsToFetch) {
        try {
          const response = await fetch(asset.path);
          if (response.ok) {
            const blob = await response.blob();
            imagesFolder.file(asset.filename, blob);
          } else {
            // If can't fetch, create a proper placeholder
            await this.createProperPlaceholder(imagesFolder, asset.filename);
          }
        } catch (error) {
          console.warn(`Could not fetch ${asset.path}, creating placeholder`);
          await this.createProperPlaceholder(imagesFolder, asset.filename);
        }
      }

      // Try to fetch audio
      try {
        const audioResponse = await fetch("./audio/music.mp3");
        if (audioResponse.ok) {
          const audioBlob = await audioResponse.blob();
          audioFolder.file("music.mp3", audioBlob);
        }
      } catch (error) {
        console.warn("Could not fetch audio file");
      }
    } catch (error) {
      console.warn("Error adding assets:", error);
      // Fallback to creating all placeholders
      await this.createAllPlaceholders(imagesFolder);
    }
  }

  async createProperPlaceholder(imagesFolder, filename) {
    return new Promise((resolve) => {
      // Create a proper minimal PNG instead of SVG
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");

      // Create different icons based on filename
      if (filename.includes("up-arrow") || filename.includes("hotspot")) {
        // Arrow up icon
        ctx.fillStyle = "#4CAF50";
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = "white";
        ctx.font = "bold 24px Arial";
        ctx.textAlign = "center";
        ctx.fillText("↑", 32, 40);
      } else if (filename.includes("close")) {
        // Close icon
        ctx.fillStyle = "#f44336";
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = "white";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("✕", 32, 40);
      } else if (filename.includes("play")) {
        // Play icon
        ctx.fillStyle = "#2196F3";
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = "white";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("▶", 32, 40);
      } else if (filename.includes("pause")) {
        // Pause icon
        ctx.fillStyle = "#FF9800";
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = "white";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("⏸", 32, 40);
      } else {
        // Default placeholder
        ctx.fillStyle = "#9E9E9E";
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = "white";
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "center";
        ctx.fillText("IMG", 32, 40);
      }

      // Convert to blob and add to zip
      canvas.toBlob((blob) => {
        imagesFolder.file(filename, blob);
        resolve();
      }, "image/png");
    });
  }

  async createAllPlaceholders(imagesFolder) {
    const placeholders = [
      "up-arrow.png",
      "close.png",
      "play.png",
      "pause.png",
      "room1.jpg",
    ];
    for (const filename of placeholders) {
      await this.createProperPlaceholder(imagesFolder, filename);
    }
  }

  // Enhanced coordinate calculation methods
  calculateSphericalPosition(intersection, camera) {
    // Convert cartesian coordinates to spherical coordinates for better 360° positioning
    const cameraPos = camera.getAttribute("position");

    // Calculate relative position from camera
    const relativePos = {
      x: intersection.point.x - cameraPos.x,
      y: intersection.point.y - cameraPos.y,
      z: intersection.point.z - cameraPos.z,
    };

    // Calculate spherical coordinates
    const radius = 8; // Fixed radius for consistency
    const theta = Math.atan2(relativePos.x, relativePos.z); // Horizontal angle
    const phi = Math.acos(
      relativePos.y /
        Math.sqrt(
          relativePos.x * relativePos.x +
            relativePos.y * relativePos.y +
            relativePos.z * relativePos.z
        )
    ); // Vertical angle

    // Convert back to cartesian with fixed radius
    return {
      x: cameraPos.x + radius * Math.sin(phi) * Math.sin(theta),
      y: cameraPos.y + radius * Math.cos(phi),
      z: cameraPos.z + radius * Math.sin(phi) * Math.cos(theta),
    };
  }

  calculateOptimalPosition(intersection, camera) {
    // This method provides the most optimal positioning for 360° panoramas
    const cameraPos = camera.getAttribute("position");

    // Get the direction vector from camera to intersection
    const direction = new THREE.Vector3(
      intersection.point.x - cameraPos.x,
      intersection.point.y - cameraPos.y,
      intersection.point.z - cameraPos.z
    );

    // Normalize to unit vector
    direction.normalize();

    // Apply optimal distance based on 360° panorama best practices
    const optimalDistance = 7.5; // Sweet spot for visibility and interaction

    return {
      x: cameraPos.x + direction.x * optimalDistance,
      y: cameraPos.y + direction.y * optimalDistance,
      z: cameraPos.z + direction.z * optimalDistance,
    };
  }

  // Scene Management Methods
  setupSceneManagement() {
    this.updateSceneDropdown();
    this.updateNavigationTargets();
    this.updateModeIndicator();
    this.updateStartingPointInfo();
  }

  // Starting Point Management
  setStartingPoint() {
    const camera = document.getElementById("cam");
    const rotation = camera.getAttribute("rotation");

    // Store the current camera rotation as the starting point
    this.scenes[this.currentScene].startingPoint = {
      rotation: {
        x: rotation.x,
        y: rotation.y,
        z: rotation.z,
      },
    };

    this.updateStartingPointInfo();

    // Show feedback
    this.showStartingPointFeedback("Starting point set to current view");
  }

  clearStartingPoint() {
    this.scenes[this.currentScene].startingPoint = null;
    this.updateStartingPointInfo();
    this.showStartingPointFeedback(
      "Starting point cleared - will use default view"
    );
  }

  updateStartingPointInfo() {
    const infoDiv = document.getElementById("starting-point-info");
    const currentScene = this.scenes[this.currentScene];

    if (currentScene.startingPoint) {
      const rotation = currentScene.startingPoint.rotation;
      infoDiv.innerHTML = `📍 Set: X:${rotation.x.toFixed(
        0
      )}° Y:${rotation.y.toFixed(0)}° Z:${rotation.z.toFixed(0)}°`;
      infoDiv.style.background = "#1B5E20";
      infoDiv.style.color = "#4CAF50";
    } else {
      infoDiv.innerHTML = "No starting point set";
      infoDiv.style.background = "#333";
      infoDiv.style.color = "#ccc";
    }
  }

  showStartingPointFeedback(message) {
    const feedback = document.createElement("div");
    feedback.style.cssText = `
      position: fixed; top: 20px; right: 380px; 
      background: rgba(76, 175, 80, 0.9); color: white; padding: 10px 15px;
      border-radius: 6px; font-weight: bold; z-index: 10001;
      font-family: Arial; font-size: 12px;
    `;
    feedback.innerHTML = `📍 ${message}`;

    document.body.appendChild(feedback);
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
    }, 3000);
  }

  applyStartingPoint() {
    const currentScene = this.scenes[this.currentScene];
    if (!currentScene.startingPoint) return;

    const camera = document.getElementById("cam");
    const rotation = currentScene.startingPoint.rotation;

    // Temporarily disable look-controls to allow rotation setting
    const lookControls = camera.components["look-controls"];
    if (lookControls) {
      lookControls.pause();
    }

    // Apply the stored rotation to the camera
    camera.setAttribute(
      "rotation",
      `${rotation.x} ${rotation.y} ${rotation.z}`
    );

    // Force the look-controls to sync with the new rotation
    if (lookControls) {
      // Update the look-controls internal state to match our rotation
      lookControls.pitchObject.rotation.x = THREE.MathUtils.degToRad(
        rotation.x
      );
      lookControls.yawObject.rotation.y = THREE.MathUtils.degToRad(rotation.y);

      // Re-enable look-controls after a short delay
      setTimeout(() => {
        lookControls.play();
      }, 100);
    }

    console.log(
      `Applied starting point rotation: X:${rotation.x}° Y:${rotation.y}° Z:${rotation.z}°`
    );
  }

  updateSceneDropdown() {
    const dropdown = document.getElementById("current-scene");
    dropdown.innerHTML = "";

    Object.keys(this.scenes).forEach((sceneId) => {
      const option = document.createElement("option");
      option.value = sceneId;
      option.textContent = this.scenes[sceneId].name;
      if (sceneId === this.currentScene) {
        option.selected = true;
      }
      dropdown.appendChild(option);
    });
  }

  updateNavigationTargets() {
    const dropdown = document.getElementById("navigation-target");
    dropdown.innerHTML = '<option value="">Select target scene...</option>';

    Object.keys(this.scenes).forEach((sceneId) => {
      if (sceneId !== this.currentScene) {
        // Don't allow navigation to current scene
        const option = document.createElement("option");
        option.value = sceneId;
        option.textContent = this.scenes[sceneId].name;
        dropdown.appendChild(option);
      }
    });
  }

  updateModeIndicator() {
    const editModeIndicator = document.getElementById("edit-indicator");
    const instructions = document.getElementById("instructions");

    if (this.navigationMode) {
      editModeIndicator.style.display = "none";
      instructions.innerHTML =
        '<strong>Navigation Mode:</strong><br>• Click navigation portals (🚪) to move between scenes<br>• Use mouse/touch to look around 360°<br>• Toggle "Edit Mode" to modify hotspots<br><br><strong style="color: #4caf50;">💡 Pro Tip:</strong><br><span style="font-size: 12px;">Current scene will be the starting point when you save/export!</span>';
    } else {
      // Edit mode (whether actively placing or not)
      if (this.editMode) {
        editModeIndicator.style.display = "block";
        instructions.innerHTML =
          '<strong>🎯 PLACING HOTSPOT:</strong><br>• Click anywhere on the 360° image to place<br>• Use mouse to rotate view first if needed<br>• Hotspot will appear with selected type<br><br><strong style="color: #2196F3;">ℹ️ Tip:</strong><br><span style="font-size: 12px;">Position carefully - you can move it later with ✎</span>';
      } else {
        editModeIndicator.style.display = "none";
        instructions.innerHTML =
          '<strong>🛠️ Edit Mode:</strong><br>1. 📝 Select hotspot type (Text/Audio/Portal)<br>2. 🎯 Click "Add Hotspot" to start placing<br>3. 📍 Click on 360° image to position<br>4. ✏️ Use Edit (✏️) to modify content<br>5. ✎ Use Move (✎) to reposition<br>6. 🧭 Uncheck "Edit Mode" to navigate<br><br><strong style="color: #4caf50;">💡 Pro Tip:</strong><br><span style="font-size: 12px;">Current scene becomes starting point on export!</span>';
      }
    }
  }

  loadCurrentScene() {
    const scene = this.scenes[this.currentScene];
    const skybox = document.getElementById("skybox");

    console.log(`Loading scene: ${this.currentScene}`, scene); // Debug log

    // Create a unique asset ID for this scene load
    const uniqueId = `panorama-${this.currentScene}-${Date.now()}`;

    // Create a new panorama asset element
    const newPanorama = document.createElement("img");
    newPanorama.id = uniqueId;
    newPanorama.crossOrigin = "anonymous"; // Important for URL images

    // Handle both URL and data URL images
    if (
      scene.image.startsWith("data:") ||
      scene.image.startsWith("http://") ||
      scene.image.startsWith("https://")
    ) {
      newPanorama.src = scene.image;
    } else {
      // For relative paths, ensure proper formatting
      newPanorama.src = scene.image.startsWith("./")
        ? scene.image
        : `./${scene.image}`;
    }

    // Get the assets container and add the new panorama
    const assets = document.querySelector("a-assets");

    // Remove any old panorama assets to prevent memory leaks
    const oldPanoramas = assets.querySelectorAll("img[id^='panorama-']");
    oldPanoramas.forEach((img) => {
      if (img.id !== uniqueId) {
        img.remove();
      }
    });

    assets.appendChild(newPanorama);

    // Set up loading handlers
    newPanorama.onload = () => {
      console.log("New panorama loaded successfully:", scene.image);

      // Temporarily hide skybox to avoid flicker
      skybox.setAttribute("visible", "false");

      // Update skybox to use the new asset
      setTimeout(() => {
        skybox.setAttribute("src", `#${uniqueId}`);
        skybox.setAttribute("visible", "true");

        console.log("Skybox updated with new image");

        // Apply starting point after scene loads
        setTimeout(() => {
          this.applyStartingPoint();
        }, 200);
      }, 100);
    };

    newPanorama.onerror = () => {
      console.error("Failed to load panorama:", scene.image);
      alert(
        `Failed to load scene image: ${scene.image}\nPlease check if the URL is accessible and is a valid image.`
      );

      // Fallback to default image
      skybox.setAttribute("src", "#main-panorama");
      skybox.setAttribute("visible", "true");
    };

    // If the image is already cached and complete, trigger onload immediately
    if (newPanorama.complete) {
      newPanorama.onload();
    }

    // Clear existing hotspots
    const container = document.getElementById("hotspot-container");
    container.innerHTML = "";

    // Load hotspots for current scene
    this.hotspots = [...scene.hotspots];
    scene.hotspots.forEach((hotspot) => {
      this.createHotspotElement(hotspot);
    });

    this.updateHotspotList();
    this.updateStartingPointInfo();
  }

  switchToScene(sceneId) {
    if (!this.scenes[sceneId]) return;

    // Save current scene hotspots
    this.scenes[this.currentScene].hotspots = [...this.hotspots];

    // Switch to new scene
    this.currentScene = sceneId;
    this.loadCurrentScene();
    this.updateNavigationTargets();
  }

  navigateToScene(sceneId) {
    if (!this.scenes[sceneId]) return;

    // Update the dropdown to reflect the change
    document.getElementById("current-scene").value = sceneId;
    this.switchToScene(sceneId);

    // Show a brief navigation indicator
    this.showNavigationFeedback(this.scenes[sceneId].name);
  }

  showNavigationFeedback(sceneName) {
    const feedback = document.createElement("div");
    feedback.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(76, 175, 80, 0.9); color: white; padding: 15px 25px;
      border-radius: 8px; font-weight: bold; z-index: 10001;
      font-family: Arial; animation: fadeInOut 2s ease-in-out;
    `;
    feedback.innerHTML = `Navigated to: ${sceneName}`;

    // Add CSS animation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(feedback);
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.parentNode.removeChild(feedback);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 2000);
  }

  addNewScene() {
    const name = prompt("Enter scene name:");
    if (!name) return;

    // Show dialog for choosing between file upload or URL
    const dialog = document.createElement("div");
    dialog.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
      align-items: center; justify-content: center; font-family: Arial;
    `;

    dialog.innerHTML = `
      <div style="background: #2a2a2a; padding: 30px; border-radius: 10px; color: white; max-width: 500px;">
        <h3 style="margin-top: 0; color: #4CAF50;">Add Scene Image</h3>
        <p>Choose how you want to add the 360° image for "${name}":</p>
        
        <div style="margin: 20px 0;">
          <button id="upload-file" style="
            background: #4CAF50; color: white; border: none; padding: 15px 25px;
            border-radius: 6px; cursor: pointer; margin: 5px; width: 200px;
            font-size: 14px; font-weight: bold;
          ">📁 Upload Image File</button>
          <div style="font-size: 12px; color: #ccc; margin-left: 5px;">
            Upload an image from your computer
          </div>
        </div>
        
        <div style="margin: 20px 0;">
          <button id="use-url" style="
            background: #2196F3; color: white; border: none; padding: 15px 25px;
            border-radius: 6px; cursor: pointer; margin: 5px; width: 200px;
            font-size: 14px; font-weight: bold;
          ">🌐 Use Image URL</button>
          <div style="font-size: 12px; color: #ccc; margin-left: 5px;">
            Use an image from the internet
          </div>
        </div>
        
        <button id="cancel-scene" style="
          background: #666; color: white; border: none; padding: 10px 20px;
          border-radius: 4px; cursor: pointer; margin-top: 10px;
        ">Cancel</button>
      </div>
    `;

    document.body.appendChild(dialog);

    document.getElementById("upload-file").onclick = () => {
      document.body.removeChild(dialog);
      this.addSceneFromFile(name);
    };

    document.getElementById("use-url").onclick = () => {
      document.body.removeChild(dialog);
      this.addSceneFromURL(name);
    };

    document.getElementById("cancel-scene").onclick = () => {
      document.body.removeChild(dialog);
    };
  }

  addSceneFromFile(name) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const sceneId = `scene_${Date.now()}`;
        this.scenes[sceneId] = {
          name: name,
          image: e.target.result, // Use data URL for uploaded images
          hotspots: [],
          startingPoint: null,
        };

        this.finalizeNewScene(sceneId, name);
      };
      reader.readAsDataURL(file);
    });

    input.click();
  }

  addSceneFromURL(name) {
    const url = prompt(
      "Enter the URL of the 360° image:\n(Make sure it's a direct link to an image file)",
      "https://"
    );
    if (!url || url === "https://") return;

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      alert("Please enter a valid URL");
      return;
    }

    // Test if the image loads
    const testImg = new Image();
    testImg.crossOrigin = "anonymous";

    testImg.onload = () => {
      const sceneId = `scene_${Date.now()}`;
      this.scenes[sceneId] = {
        name: name,
        image: url, // Use URL directly for online images
        hotspots: [],
        startingPoint: null,
      };

      this.finalizeNewScene(sceneId, name);
    };

    testImg.onerror = () => {
      alert(
        "Failed to load image from URL. Please check:\n1. The URL is correct\n2. The image exists\n3. The server allows cross-origin requests"
      );
    };

    testImg.src = url;
  }

  finalizeNewScene(sceneId, name) {
    this.updateSceneDropdown();
    this.updateNavigationTargets();

    // Switch to new scene with a small delay to ensure UI is updated
    setTimeout(() => {
      document.getElementById("current-scene").value = sceneId;
      this.switchToScene(sceneId);
      alert(`Scene "${name}" added successfully!`);
    }, 100);
  }

  showSceneManager() {
    const dialog = document.createElement("div");
    dialog.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
      align-items: center; justify-content: center; font-family: Arial;
    `;

    let sceneListHTML = "";
    Object.keys(this.scenes).forEach((sceneId) => {
      const scene = this.scenes[sceneId];
      const hotspotCount = scene.hotspots.length;
      const imageSource = scene.image.startsWith("http")
        ? "Online"
        : scene.image.startsWith("data:")
        ? "Uploaded"
        : "File";
      sceneListHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; margin: 5px 0; background: #333; border-radius: 6px;">
          <div style="flex: 1;">
            <strong>${scene.name}</strong><br>
            <small style="color: #ccc;">${hotspotCount} hotspot(s) • ${imageSource} image</small>
          </div>
          <div style="display: flex; gap: 6px;">
            <button onclick="window.hotspotEditor.editSceneImage('${sceneId}')" style="
              background: #2196F3; color: white; border: none; padding: 6px 12px;
              border-radius: 4px; cursor: pointer; font-size: 12px;" title="Change scene image">
              🖼️ Edit Image
            </button>
            <button onclick="window.hotspotEditor.deleteScene('${sceneId}')" style="
              background: #f44336; color: white; border: none; padding: 6px 12px;
              border-radius: 4px; cursor: pointer; font-size: 12px;" ${
                sceneId === "room1"
                  ? 'disabled title="Cannot delete default scene"'
                  : ""
              }>
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    });

    dialog.innerHTML = `
      <div style="background: #2a2a2a; padding: 30px; border-radius: 10px; color: white; max-width: 600px; max-height: 80vh; overflow-y: auto;">
        <h3 style="margin-top: 0; color: #4CAF50;">🎬 Scene Manager</h3>
        <p style="margin: 0 0 20px; color: #ccc; font-size: 14px;">Manage your 360° scenes and images</p>
        <div style="margin: 20px 0;">
          ${sceneListHTML}
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="
          background: #666; color: white; border: none; padding: 12px 20px;
          border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold;
        ">Close Manager</button>
      </div>
    `;

    document.body.appendChild(dialog);
  }

  editSceneImage(sceneId) {
    const scene = this.scenes[sceneId];
    if (!scene) return;

    // Close current scene manager
    document.querySelectorAll("div").forEach((div) => {
      if (div.style.position === "fixed" && div.style.zIndex === "10000") {
        div.remove();
      }
    });

    const dialog = document.createElement("div");
    dialog.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.8); z-index: 10000; display: flex; 
      align-items: center; justify-content: center; font-family: Arial;
    `;

    dialog.innerHTML = `
      <div style="background: #2a2a2a; padding: 30px; border-radius: 10px; color: white; max-width: 500px;">
        <h3 style="margin-top: 0; color: #4CAF50;">🖼️ Change Scene Image</h3>
        <p style="color: #ccc;">Update the 360° image for "${scene.name}":</p>
        
        <div style="margin: 20px 0;">
          <button id="upload-new-file" style="
            background: #4CAF50; color: white; border: none; padding: 15px 25px;
            border-radius: 6px; cursor: pointer; margin: 5px; width: 200px;
            font-size: 14px; font-weight: bold;
          ">📁 Upload New Image</button>
          <div style="font-size: 12px; color: #ccc; margin-left: 5px;">
            Upload a new image from your computer
          </div>
        </div>
        
        <div style="margin: 20px 0;">
          <button id="use-new-url" style="
            background: #2196F3; color: white; border: none; padding: 15px 25px;
            border-radius: 6px; cursor: pointer; margin: 5px; width: 200px;
            font-size: 14px; font-weight: bold;
          ">🌐 Use Image URL</button>
          <div style="font-size: 12px; color: #ccc; margin-left: 5px;">
            Use an image from the internet
          </div>
        </div>
        
        <div style="display: flex; gap: 8px; margin-top: 20px;">
          <button id="cancel-edit" style="
            background: #666; color: white; border: none; padding: 10px 20px;
            border-radius: 4px; cursor: pointer; flex: 1;
          ">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const close = () => {
      if (dialog && dialog.parentNode) dialog.parentNode.removeChild(dialog);
      // Reopen scene manager
      setTimeout(() => this.showSceneManager(), 100);
    };

    dialog.querySelector("#cancel-edit").onclick = close;

    dialog.querySelector("#upload-new-file").onclick = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          scene.image = e.target.result;
          if (sceneId === this.currentScene) {
            this.loadCurrentScene();
          }
          close();
          this.showStartingPointFeedback(`Updated image for "${scene.name}"`);
        };
        reader.readAsDataURL(file);
      };
      input.click();
    };

    dialog.querySelector("#use-new-url").onclick = () => {
      const url = prompt(
        `Enter the URL of the new 360° image for "${scene.name}":\n(Make sure it's a direct link to an image file)`,
        scene.image.startsWith("http") ? scene.image : "https://"
      );
      if (!url || url === "https://") return;

      try {
        new URL(url);
      } catch (e) {
        alert("Please enter a valid URL");
        return;
      }

      const testImg = new Image();
      testImg.crossOrigin = "anonymous";
      testImg.onload = () => {
        scene.image = url;
        if (sceneId === this.currentScene) {
          this.loadCurrentScene();
        }
        close();
        this.showStartingPointFeedback(`Updated image for "${scene.name}"`);
      };
      testImg.onerror = () => {
        alert(
          "Failed to load image from URL. Please check the URL is correct and accessible."
        );
      };
      testImg.src = url;
    };
  }

  deleteScene(sceneId) {
    if (sceneId === "room1") {
      alert("Cannot delete the default scene.");
      return;
    }

    if (!confirm(`Delete scene "${this.scenes[sceneId].name}"?`)) return;

    delete this.scenes[sceneId];

    // If we're currently on the deleted scene, switch to room1
    if (this.currentScene === sceneId) {
      this.currentScene = "room1";
      document.getElementById("current-scene").value = "room1";
      this.loadCurrentScene();
    }

    this.updateSceneDropdown();
    this.updateNavigationTargets();

    // Close and reopen scene manager to refresh the list
    document.querySelectorAll("div").forEach((div) => {
      if (div.style.position === "fixed" && div.style.zIndex === "10000") {
        div.remove();
      }
    });
    this.showSceneManager();
  }
}

// Modified spot component for editor
AFRAME.registerComponent("editor-spot", {
  schema: {
    label: { type: "string", default: "" },
    audio: { type: "string", default: "" },
    labelBackground: { type: "color", default: "#333333" },
    labelPadding: { type: "number", default: 0.2 },
    popup: { type: "string", default: "" },
    popupWidth: { type: "number", default: 3 },
    popupHeight: { type: "number", default: 2 },
    popupColor: { type: "color", default: "#333333" },
    navigation: { type: "string", default: "" },
  },

  init: function () {
    const data = this.data;
    const el = this.el;

    // Don't override the src - let createHotspotElement set the appropriate icon
    // el.setAttribute("src", "#hotspot"); // REMOVED - was overriding icon choice
    el.setAttribute("class", "clickable");

    // Add highlight animation
    el.setAttribute("animation__highlight", {
      property: "scale",
      from: "1 1 1",
      to: "1.5 1.5 1.5",
      dur: 500,
      easing: "easeInOutQuad",
      startEvents: "highlight",
      autoplay: false,
      loop: 2,
      dir: "alternate",
    });

    // Add hover animations
    el.setAttribute("animation__hover_in", {
      property: "scale",
      to: "1.2 1.2 1.2",
      dur: 200,
      easing: "easeOutQuad",
      startEvents: "mouseenter",
    });

    el.setAttribute("animation__hover_out", {
      property: "scale",
      to: "1 1 1",
      dur: 200,
      easing: "easeOutQuad",
      startEvents: "mouseleave",
    });

    /******************  POPUP  ******************/
    if (data.popup) {
      /* info icon */
      const infoIcon = document.createElement("a-entity");
      infoIcon.setAttribute(
        "geometry",
        "primitive: plane; width: 4; height: 0.5"
      );
      infoIcon.setAttribute("material", "color: #00FF00");
      infoIcon.setAttribute(
        "text",
        "value: click for more info; align: center; color: black; width: 6; font: roboto"
      );
      infoIcon.setAttribute("position", "0 1 0");
      infoIcon.classList.add("clickable");
      infoIcon.setAttribute("animation__hover_in", {
        property: "scale",
        to: "1.1 1.1 1",
        dur: 200,
        easing: "easeOutQuad",
        startEvents: "mouseenter",
      });

      infoIcon.setAttribute("animation__hover_out", {
        property: "scale",
        to: "1 1 1",
        dur: 200,
        easing: "easeOutQuad",
        startEvents: "mouseleave",
      });
      el.appendChild(infoIcon);

      /* popup container */
      const popup = document.createElement("a-entity");
      popup.setAttribute("visible", "false");
      // Move popup slightly forward on z-axis to avoid z-fighting with info icon
      popup.setAttribute("position", "0 1.5 0.05");
      popup.setAttribute("look-at", "#cam");
      popup.setAttribute("animation__scale_in", {
        property: "scale",
        from: "0 0 0",
        to: "1 1 1",
        dur: 300,
        easing: "easeOutBack",
        startEvents: "popup-open",
      });
      popup.setAttribute("animation__scale_out", {
        property: "scale",
        to: "0 0 0",
        dur: 200,
        easing: "easeInQuad",
        startEvents: "popup-close",
      });

      /* background */
      const background = document.createElement("a-plane");
      background.setAttribute("color", data.popupColor);
      background.setAttribute("opacity", 1); // Solid black
      background.setAttribute("width", data.popupWidth);
      background.setAttribute("height", data.popupHeight);
      popup.appendChild(background);

      /* text */
      const text = document.createElement("a-text");
      text.setAttribute("value", data.popup);
      text.setAttribute("wrap-count", 35);
      text.setAttribute("color", "white");
      text.setAttribute("position", "0 0 0.01");
      text.setAttribute("align", "center");
      text.setAttribute("width", "6");
      text.setAttribute("font", "roboto");
      popup.appendChild(text);

      /* close button */
      const closeButton = document.createElement("a-image");
      const margin = 0.3;
      closeButton.setAttribute(
        "position",
        `${data.popupWidth / 2 - margin} ${data.popupHeight / 2 - margin} 0.02`
      );
      closeButton.setAttribute("src", "#close");
      closeButton.setAttribute("width", "0.4");
      closeButton.setAttribute("height", "0.4");
      closeButton.classList.add("clickable");
      popup.appendChild(closeButton);

      /* event wiring */
      infoIcon.addEventListener("click", function (e) {
        e.stopPropagation();
        popup.setAttribute("visible", true);
        infoIcon.setAttribute("visible", false); // Hide info icon when popup is open
        popup.emit("popup-open");
      });

      // Hover animations for close button
      closeButton.setAttribute("animation__hover_in", {
        property: "scale",
        to: "1.2 1.2 1",
        dur: 200,
        easing: "easeOutQuad",
        startEvents: "mouseenter",
      });

      closeButton.setAttribute("animation__hover_out", {
        property: "scale",
        to: "1 1 1",
        dur: 200,
        easing: "easeOutQuad",
        startEvents: "mouseleave",
      });

      closeButton.addEventListener("click", (e) => {
        e.stopPropagation();
        popup.emit("popup-close");
        setTimeout(() => {
          popup.setAttribute("visible", false);
          infoIcon.setAttribute("visible", true); // Show info icon when popup is closed
        }, 250);
      });

      el.appendChild(popup);
    }

    /******************  LABEL  ******************/
    if (data.label) {
      const labelContainer = document.createElement("a-entity");
      labelContainer.setAttribute("position", "0 -0.6 0");

      const bg = document.createElement("a-plane");
      bg.setAttribute("color", data.labelBackground);
      bg.setAttribute("opacity", 0.8);
      bg.setAttribute("width", data.label.length * 0.15 + data.labelPadding);
      bg.setAttribute("height", 0.3);
      bg.setAttribute("position", "0 0 -0.01");

      const textEl = document.createElement("a-text");
      textEl.setAttribute("value", data.label);
      textEl.setAttribute("align", "center");
      textEl.setAttribute("color", "#FFFFFF");
      textEl.setAttribute("width", "6");
      textEl.setAttribute("font", "roboto");

      labelContainer.appendChild(bg);
      labelContainer.appendChild(textEl);
      el.appendChild(labelContainer);
    }

    /******************  AUDIO  ******************/
    if (data.audio) {
      const audioEl = document.createElement("a-sound");
      audioEl.setAttribute("src", data.audio);
      audioEl.setAttribute("autoplay", "false");
      audioEl.setAttribute("loop", "true");
      el.appendChild(audioEl);

      const btn = document.createElement("a-image");
      btn.setAttribute("class", "clickable audio-control");
      btn.setAttribute("src", "#play");
      btn.setAttribute("width", "0.5");
      btn.setAttribute("height", "0.5");
      btn.setAttribute("position", "0 -1 0.02");
      el.appendChild(btn);

      let audioReady = false;
      let isPlaying = false;

      const toggleAudio = () => {
        if (!audioReady) return;

        if (isPlaying) {
          audioEl.components.sound.stopSound();
          btn.emit("fadeout");
          setTimeout(() => {
            btn.setAttribute("src", "#play");
            btn.emit("fadein");
          }, 200);
        } else {
          audioEl.components.sound.playSound();
          btn.emit("fadeout");
          setTimeout(() => {
            btn.setAttribute("src", "#pause");
            btn.emit("fadein");
          }, 200);
        }

        isPlaying = !isPlaying;
      };

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!audioEl.components.sound) return;
        toggleAudio();
      });

      btn.addEventListener("triggerdown", (e) => {
        e.stopPropagation();
        if (!audioEl.components.sound) return;
        toggleAudio();
      });

      btn.setAttribute("animation__hover_in", {
        property: "scale",
        to: "1.2 1.2 1",
        dur: 200,
        easing: "easeOutQuad",
        startEvents: "mouseenter",
      });

      btn.setAttribute("animation__hover_out", {
        property: "scale",
        to: "1 1 1",
        dur: 200,
        easing: "easeOutQuad",
        startEvents: "mouseleave",
      });

      btn.setAttribute("animation__fadeout", {
        property: "material.opacity",
        to: 0,
        dur: 200,
        easing: "easeInQuad",
        startEvents: "fadeout",
      });

      btn.setAttribute("animation__fadein", {
        property: "material.opacity",
        to: 1,
        dur: 200,
        easing: "easeOutQuad",
        startEvents: "fadein",
      });

      audioEl.addEventListener("sound-loaded", () => {
        audioReady = true;
        audioEl.components.sound.stopSound();
      });
    }

    /******************  NAVIGATION  ******************/
    if (data.navigation) {
      // Navigation hotspots use a different color scheme
      el.setAttribute("material", "color: #2196F3"); // Blue for navigation

      // Add portal effect
      el.setAttribute("animation__portal_rotate", {
        property: "rotation",
        to: "0 360 0",
        dur: 4000,
        easing: "linear",
        loop: true,
      });

      // Add pulsing effect
      el.setAttribute("animation__portal_pulse", {
        property: "scale",
        from: "1 1 1",
        to: "1.1 1.1 1.1",
        dur: 2000,
        easing: "easeInOutSine",
        loop: true,
        dir: "alternate",
      });
    }
  },
});

// Initialize the editor when the page loads
document.addEventListener("DOMContentLoaded", () => {
  // Wait for A-Frame to be ready
  setTimeout(() => {
    window.hotspotEditor = new HotspotEditor();
  }, 1000);
});
