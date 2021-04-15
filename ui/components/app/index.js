import React, { Component } from "react";
import "./app.scss";
import Header from "../header";
import Results from "../results";
import Config from "../config";
import Notification from "../notification";

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      portfolio: {},
      state: {},
      config: {},
      notification: {},
    };
    this.onValueChange = this.onValueChange.bind(this);
    this.onApplyClicked = this.onApplyClicked.bind(this);
  }

  async componentDidMount() {
    this.setState({
      portfolio: await (await fetch("/api/portfolio")).json(),
      state: await (await fetch("/api/state")).json(),
      config: await (await fetch("/api/config")).json(),
    });
  }

  onValueChange(name, value) {
    const isNumber = name !== "strategy" && name !== "isTesting";
    this.setState({
      config: {
        ...this.state.config,
        [name]: isNumber ? parseFloat(value) : value,
      },
    });
  }

  _postNotification(message, level) {
    this.setState({
      notification: { message, level },
    });
    setTimeout(() => {
      this.setState({
        notification: {},
      });
    }, 3000);
  }

  async onApplyClicked() {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.state.config),
      });
      this._postNotification("New config applied", "info");
      console.log(await res.json());
    } catch (err) {
      this._postNotification("Config update failed", "error");
    }
  }

  render() {
    const { portfolio, state, config, notification } = this.state;
    const btc = state.products
      ? state.products.find((prod) => prod.id === "BTC-USD") || {}
      : {};
    const eth = state.products
      ? state.products.find((prod) => prod.id === "ETH-USD") || {}
      : {};
    return (
      <div className="app-container">
        <Notification
          level={notification.level}
          message={notification.message}
        />
        <header className="app-header">
          <Header onApplyClicked={this.onApplyClicked} />
        </header>
        <aside className="app-results">
          <Results
            gain={portfolio.gain || 0}
            value={portfolio.value || 0}
            tickers={{
              market: [state.marketGain, state.marketSlopeCategory],
              ["BTC-USD"]: [btc.change, btc.slopeCategory],
              ["ETH-USD"]: [eth.change, btc.slopeCategory],
            }}
          />
        </aside>
        <section className="app-config">
          <Config config={config} onValueChange={this.onValueChange} />
        </section>
        <footer className="app-footer">&copy;2021 Groundwire LLC.</footer>
      </div>
    );
  }
}
