import React, { Component } from "react";
import Header from "../header";
import Results from "../results";

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      portfolio: {},
      state: {},
    };
  }

  async componentDidMount() {
    this.setState({
      portfolio: await (await fetch("/api/portfolio")).json(),
      state: await (await fetch("/api/state")).json(),
    });
  }

  render() {
    const { portfolio, state } = this.state;
    return (
      <div className="app-container">
        <Header />
        <Results gain={portfolio.gain || 0} value={portfolio.value || 0} />
      </div>
    );
  }
}
