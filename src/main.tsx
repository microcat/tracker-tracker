/*global chrome*/
import React from 'react';
import './main.css';
import {Storage, TrackingAPI, TrackerInfo, TrackerMap} from './api';
import {prettyPrintTimeSince} from './helpers';


export class MainPage extends React.Component<{}, {trackerDict: TrackerMap}> {
    storage: Storage;
    constructor(props: {}) {
        super(props);

        this.refreshTracker = this.refreshTracker.bind(this);

        this.state = {trackerDict: {}};
        this.storage = new Storage((jsonTrackers: TrackerMap) => {
            this.setState({trackerDict: jsonTrackers})
        });
    }

    refreshTracker(tracker: TrackerInfo) {
        // fetch new info, store it, then update state
        TrackingAPI.getUpdatedTrackingInfo(tracker, (updatedTracker: TrackerInfo) => {
            this.storage.addOrUpdateTracker(updatedTracker, () => {
                this.setState({trackerDict: this.storage.jsonTrackers});
            })
        })
    }

    render() {
        // TODO: add thing, remove things, refresh things, "old" section, load
        const trackers = Object.values(this.state.trackerDict);
        // XXX: this is inefficient, fixme
        trackers.sort((a, b) => {return Date.parse(a.created_at) - Date.parse(b.created_at)});
        return (
            <div className="mainPage">
                {trackers.map(t => <TrackerView tracker={t} refreshTracker={this.refreshTracker} />)}
            </div>
        );
    }
}


class TrackerView extends React.Component<{tracker: TrackerInfo, refreshTracker: (tracker: TrackerInfo) => void}, {}> {
    constructor(props) {
        super(props);

        this.handleRefreshTracker = this.handleRefreshTracker.bind(this);
    }
    // TODO: add subtag/subtag_message for extra detail
    getDeliveredOrDetails(t: TrackerInfo): string {
        if (t.shipment_delivery_date !== null) {
            return `Delivered ${prettyPrintTimeSince(t.shipment_delivery_date!)}`;
        }
        let output = t.subtag_message;
        if (t.expected_delivery !== null){
            output += `: expected ${t.expected_delivery}`;
        }
        return output;
    }

    handleRefreshTracker() {
        // let the parent know to refresh!
        // TODO: update state to show the refresh is in progress, pass callback
        this.props.refreshTracker(this.props.tracker);
    }

    render() {
        const t = this.props.tracker;
        return (
            <div className="trackerInfo">
                <div className="label">{t.label} - {t.tag.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div className="trackingDetails">{this.getDeliveredOrDetails(t).toLowerCase()}</div>
                <div className="trackingNumber"><br />{t.slug} @ <a href={t.tracking_url} target="_blank">{t.tracking_number}</a></div>
                <div className="lastUpdated">
                <div> added {prettyPrintTimeSince(t.created_at)} </div>
                <div> last updated {prettyPrintTimeSince(t.last_updated_at)} </div>
                </div>
                <div className="trackingActions">
                    <span>delete</span>
                    <span onClick={this.handleRefreshTracker}>refresh</span>
                </div>
            </div>
        )
    }
}

export class PanelView extends React.Component<{}, {}> {
    openMain() {
        chrome.tabs.create({url: 'index.html#main'});
    }

    render() {
        return (
            <div className="panelView">
                <AddTrackerForm />
                <hr />
                <button onClick={this.openMain}>See all trackers</button>
            </div>
        )
    }
}

type AddTrackerFormState = {
    tracking_number: string,
    label: string,
    buttonText: string,
    inProgress: boolean
};

class AddTrackerForm extends React.Component<{}, AddTrackerFormState> {
// TODO: fix chrome autocomplete
    storage: Storage;
    ticker: any;
    constructor(props: {}) {
        super(props);
        this.state = {tracking_number: '', label: '', buttonText: 'Track', inProgress: false};

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.storage = new Storage((jsonTrackers: TrackerMap) => {});
        this.ticker = undefined;
    }

    handleChange(event) {
        this.setState({[event.target.name.substring(8)]: event.target.value, buttonText: 'Track'} as any);
    }

    tick() {
        // Animate a ...
        let newText = this.state.buttonText + '.';
        if (newText.length === 4) {
            newText = '.';
        }
        this.setState({buttonText: newText})
    }

    handleSubmit(event) {
        this.setState({buttonText: '.', inProgress: true});
        this.ticker = setInterval(
          () => this.tick(),
          250
        );
        // TODO: the aftership API takes a while to actually fetch the tracking info, it will return PENDING
        // Should wait a minute then update it in the background.
        TrackingAPI.addTrackingNumber(
            this.state.tracking_number,
            this.state.label,
            (tracker: TrackerInfo) => {
                this.storage.addOrUpdateTracker(tracker, () => {
                    clearInterval(this.ticker);
                    this.setState({tracking_number: '', label: '', buttonText: 'Done!', inProgress: false});
                })
            }
        )
        event.preventDefault();
    }

    render() {
        const alreadyBeingTracked = this.storage.trackerExists(this.state.tracking_number);
        const formEnabled = (
            this.state.tracking_number.length > 0 && this.state.label.length > 0 && !alreadyBeingTracked && !this.state.inProgress
        );

        let inputText = 'Track';

        const validationMessage = alreadyBeingTracked ? "You're already tracking this" : "";
        return (
            <div>
                <form onSubmit={this.handleSubmit}>
                    <label>
                        <input type="hidden" value="dealwithautocomplete" />
                        <input type="text" placeholder="Add a tracking number" value={this.state.tracking_number} onChange={this.handleChange} name="dontautotracking_number" />
                        <input type="text" placeholder="What's it for?" value={this.state.label} onChange={this.handleChange} name="dontautolabel" />
                    </label>
                    <input type="submit" value={this.state.buttonText} disabled={!formEnabled} name="track" />
                </form>
                <div className="formValidationMessage">
                    {validationMessage}
                </div>
            </div>
        );
    }
}
