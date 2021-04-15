import React, { Component } from "react";
import classNames from "classnames";
import "./notification.scss";

export default class Notification extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    const { message, level } = this.props;
    const containerClasses = classNames({
      ["notification-container"]: true,
      [level]: level,
      show: message && level,
    });
    return <div className={containerClasses}>{message}</div>;
  }
}
