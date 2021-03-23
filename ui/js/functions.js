// Initialize state
let state = {
  wakeTime: 0,
  fraction: 0,
  margin: 0,
  stopMargin: 0,
  walkAway: 0,
  maxVwap: 0,
  minSlope: 0,
  maxVolatility: 0,
  minLoss: 0,
  maxRSI: 0,
  minRelVol: 0,
  strategy: "change",
  isTesting: "on",
  maxOrders: 0,
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

function showConditionalControls(strategy) {
  const conditionalControls = [
    "minLoss",
    "maxVolatility",
    "maxVwap",
    "minSlope",
    "minRelVol",
  ];
  const conditionalElMap = {
    change: ["minLoss"],
    volatility: ["maxVolatility"],
    compositeScore: ["maxVwap", "minSlope"],
    vwap: ["maxVwap"],
    slope: ["minSlope"],
    relativeVolume: ["minRelVol"],
  };

  const getWrapper = (id) => document.querySelector(`.input-wrapper#${id}`);
  conditionalControls.forEach((id) => {
    getWrapper(id).classList.add("hide");
  });
  conditionalElMap[strategy].forEach((id) => {
    getWrapper(id).classList.remove("hide");
  });
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
    if (target.name === "strategy") {
      showConditionalControls(target.value);
    }
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

function getPercentValue(val) {
  const str = val.toString();
  if (str.length > 5) {
    return +val.toFixed(3);
  }
  return val;
}

function initializeState(config) {
  Object.entries(config).forEach(function ([attr, val]) {
    if (attr === "wakeTime") {
      setState("wakeTime", +config.wakeTime.match(/(\d+)(s|m|h)/)[1]);
    } else if (attr === "isTesting") {
      setState("isTesting", val ? "on" : "off");
    } else if (attr === "strategy") {
      setState("strategy", val);
    } else if (attr === "maxOrders") {
      setState("maxOrders", val);
    } else if (attr === "minRelVol") {
      setState("minRelVol", val);
    } else if (attr === "maxRSI") {
      setState("maxRSI", val);
    } else {
      setState(attr, getPercentValue(val * 100));
    }
  });
}

function setNotification(message, level) {
  const notifyEl = document.getElementById("notification");
  switch (level) {
    case "info":
      notifyEl.classList.add("info");
      notifyEl.innerText = message;
      break;
    case "error":
      notifyEl.classList.add("error");
      notifyEl.innerText = message;
      break;
    default:
    // do nothing
  }

  setTimeout(() => {
    notifyEl.className = "";
    notifyEl.innerText = "";
  }, 3000);
}

async function sendWalk() {
  const res = await fetch("/api/walk");
  const status = await res.json();
  console.log(status);
  setNotification("Walked away successfully", "info");
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
    } else if (attr === "maxOrders") {
      reqData.maxOrders = val;
    } else if (attr === "minRelVol") {
      reqData.minRelVol = val;
    } else if (attr === "maxRSI") {
      reqData.maxRSI = val;
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
    setNotification("New configuration successful", "info");
  } catch (err) {
    console.error("FAILED POST");
  }
}

window.onload = async function main() {
  const configRes = await fetch("/api/config");
  const config = await configRes.json();
  console.log(config);

  const portfolioRes = await fetch("/api/portfolio");
  const portfolio = await portfolioRes.json();

  bootstrapInput(elements, "strategy", "select");
  bootstrapInput(elements, "wakeTime", "input");
  bootstrapInput(elements, "maxOrders", "input");
  bootstrapInput(elements, "fraction", "input");
  bootstrapInput(elements, "margin", "input");
  bootstrapInput(elements, "stopMargin", "input");
  bootstrapInput(elements, "walkAway", "input");
  bootstrapInput(elements, "maxVwap", "input");
  bootstrapInput(elements, "minSlope", "input");
  bootstrapInput(elements, "maxVolatility", "input");
  bootstrapInput(elements, "minLoss", "input");
  bootstrapInput(elements, "minRelVol", "input");
  bootstrapInput(elements, "maxRSI", "input");
  bootstrapInput(elements, "minLoss", "input");
  bootstrapInput(elements, "isTesting", "button");

  const gainDisplayEl = document.getElementById("gain-display");
  gainDisplayEl.classList.add(portfolio.gain >= 0 ? "green" : "red");
  gainDisplayEl.innerText = `${(portfolio.gain * 100).toFixed(2)}%`;

  const applyButton = document.getElementById("apply");
  applyButton.addEventListener("click", sendConfig);

  const walkButton = document.getElementById("force-walk");
  walkButton.addEventListener("click", sendWalk);

  const refreshButton = document.getElementById("refresh");
  refreshButton.addEventListener("click", () => window.location.reload());

  initializeState(config);
  elements.inputs["isTesting"].classList.add(state.isTesting);

  showConditionalControls(state.strategy);
  render(state);
};
