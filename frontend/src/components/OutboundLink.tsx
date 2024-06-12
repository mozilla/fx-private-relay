import React from "react";
import ReactGA from "react-ga4";

export type TrackerNames = string[];

export interface OutboundLinkProps {
  eventLabel?: string;
  to?: string;
  target?: string;
  onClick?: () => void;
  trackerNames?: TrackerNames;
}

const NEWTAB = "_blank";
const MIDDLECLICK = 1;

export default class OutboundLink extends React.Component {
  props: OutboundLinkProps & React.HTMLProps<HTMLAnchorElement> = {};
  static trackLink = (eventMeta, hitCallback, _trackerNames) => {
    ReactGA.outboundLink(eventMeta, hitCallback);
  };

  handleClick = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    const { target, eventLabel, to, onClick, trackerNames } = this.props;
    const eventMeta = { label: eventLabel };
    const sameTarget = target !== NEWTAB;
    const normalClick = !(
      event.ctrlKey ||
      event.shiftKey ||
      event.metaKey ||
      event.button === MIDDLECLICK
    );

    if (sameTarget && normalClick) {
      event.preventDefault();
      OutboundLink.trackLink(
        eventMeta,
        () => {
          window.location.href = to;
        },
        trackerNames,
      );
    } else {
      OutboundLink.trackLink(eventMeta, () => {}, trackerNames);
    }

    if (onClick) {
      onClick(event);
    }
  };

  render() {
    const { to: href, target, ...oldProps } = this.props;
    const props = {
      ...oldProps,
      target,
      href,
      onClick: this.handleClick,
    };

    if (target === NEWTAB) {
      props.rel = `${props.rel ? props.rel : ""} noopener noreferrer`.trim();
    }

    delete props.eventLabel;
    delete props.trackerNames;
    return React.createElement("a", props);
  }
}
