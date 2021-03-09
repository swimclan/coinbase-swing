// Initialize state
let state = {
  wakeTime: 0,
  fraction: 0,
  margin: 0,
  stopMargin: 0,
  walkAway: 0,
  maxVwap: 0,
  minSlope: 0,
  strategy: "change",
  isTesting: "on",
};
// Initialize elements
let elements = {
  inputs: nullifyStateAttributes(state),
  values: nullifyStateAttributes(state),
};

function nullifyStateAttributes(state) {
  return {
    ...Object.keys(state).reduce((acc, attr) => {
      return { ...acc, [attr]: null };
    }, {}),
  };
}

function render(state) {
  Object.entries(state).forEach(function ([attr, val]) {
    elements.values[attr].innerText = val;
    elements.inputs[attr].value = val;
  });
}

function setState(attr, value) {
  state[attr] = value;
}

function onChange(attr) {
  return function ({ target }) {
    if (target.tagName === "BUTTON") {
      target.classList.remove(state[attr]);
      setState(attr, state[attr] === "on" ? "off" : "on");
      target.classList.add(state[attr]);
    } else {
      const newValue = +target.value;
      setState(attr, !isNaN(newValue) ? newValue : target.value);
    }
    render(state);
    console.log(state);
  };
}

function bootstrapInput(elements, attr, elType) {
  const eventTypes = {
    select: "change",
    input: "input",
    button: "click",
  };
  elements.inputs[attr] = document.querySelector(`#${attr} ${elType}`);
  elements.values[attr] = document.querySelector(`#${attr} .value`);
  elements.inputs[attr].addEventListener(eventTypes[elType], onChange(attr));
}

function initializeState(config) {
  Object.entries(config).forEach(function ([attr, val]) {
    if (attr === "wakeTime") {
      setState("wakeTime", +config.wakeTime.match(/(\d+)(s|m|h)/)[1]);
    } else if (attr === "isTesting") {
      setState("isTesting", val ? "on" : "off");
    } else if (attr === "strategy") {
      setState("strategy", val);
    } else {
      setState(attr, val * 100);
    }
  });
}

async function sendConfig() {
  const reqData = {};
  Object.entries(state).forEach(function ([attr, val]) {
    if (attr === "wakeTime") {
      reqData.wakeTime = `${val}m`;
    } else if (attr === "isTesting") {
      reqData.isTesting = val === "on";
    } else if (attr === "strategy") {
      reqData.strategy = val;
    } else {
      reqData[attr] = val / 100;
    }
  });
  try {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqData),
    });
    console.log(await res.json());
  } catch (err) {
    console.error("FAILED POST");
  }
}

window.onload = async function main() {
  const configRes = await fetch("/api/config");
  const config = await configRes.json();
  console.log(config);

  bootstrapInput(elements, "strategy", "select");
  bootstrapInput(elements, "wakeTime", "input");
  bootstrapInput(elements, "fraction", "input");
  bootstrapInput(elements, "margin", "input");
  bootstrapInput(elements, "stopMargin", "input");
  bootstrapInput(elements, "walkAway", "input");
  bootstrapInput(elements, "maxVwap", "input");
  bootstrapInput(elements, "minSlope", "input");
  bootstrapInput(elements, "isTesting", "button");

  const applyButton = document.getElementById("apply");
  applyButton.addEventListener("click", sendConfig);

  initializeState(config);
  elements.inputs["isTesting"].classList.add(state.isTesting);
  render(state);
};
