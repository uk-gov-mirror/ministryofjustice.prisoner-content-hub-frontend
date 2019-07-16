const {
  parse,
  distanceInWords,
  format,
  isValid,
  isBefore,
} = require('date-fns');
const { propOr, prop } = require('ramda');

const { capitalize } = require('../utils');

const prettyDate = date => {
  if (!isValid(new Date(date))) return 'Unavailable';
  return format(parse(date), 'dddd DD MMMM YYYY');
};

const prettyTime = date => {
  if (!isValid(new Date(date))) return '';
  return format(parse(date), 'h:mma');
};

const getTimeOfDay = date => {
  if (!isValid(new Date(date))) return '';

  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const nowDay = now.getDate();
  const morning = new Date(nowYear, nowMonth, nowDay, 12, 0, 0);
  const afternoon = new Date(nowYear, nowMonth, nowDay, 17, 0, 0);

  if (isBefore(date, morning)) {
    return 'morning';
  }
  if (isBefore(date, afternoon)) {
    return 'afternoon';
  }
  return 'evening';
};

const getEventsForTimeOfDay = (events, timeOfDay) => {
  return events
    .filter(event => {
      const eventTimeOfDay = getTimeOfDay(prop('startTime', event));

      return eventTimeOfDay === timeOfDay;
    })
    .map(event => {
      const startTime = prettyTime(prop('startTime', event));
      const endTime = prettyTime(prop('endTime', event));

      return {
        title: event.eventSourceDesc,
        startTime,
        endTime,
        timeString: endTime === '' ? startTime : `${startTime} to ${endTime}`,
      };
    });
};

module.exports = function createOffenderService(repository) {
  async function getOffenderDetailsFor(prisonerId) {
    const {
      bookingId,
      offenderNo,
      firstName,
      lastName,
    } = await repository.getOffenderDetailsFor(prisonerId);

    return {
      bookingId,
      offenderNo,
      name: `${capitalize(firstName)} ${capitalize(lastName)}`,
    };
  }

  async function getIEPSummaryFor(bookingId) {
    const iePSummary = await repository.getIEPSummaryFor(bookingId);

    return {
      reviewDate: 'Unavailable',
      iepLevel: iePSummary.iepLevel,
      daysSinceReview: distanceInWords(parse(iePSummary.iepDate), new Date()),
    };
  }

  async function getBalancesFor(bookingId) {
    const balances = await repository.getBalancesFor(bookingId);
    const getOrDefault = propOr('Unavailable');

    return {
      spends: getOrDefault('spends', balances),
      cash: getOrDefault('cash', balances),
      savings: getOrDefault('savings', balances),
      currency: getOrDefault('currency', balances),
    };
  }

  async function getKeyWorkerFor(prisonerId) {
    const keyWorker = await repository.getKeyWorkerFor(prisonerId);

    if (!keyWorker) {
      return {
        current: 'Unavailable',
        lastMeeting: 'Unavailable',
      };
    }

    return {
      current: `${capitalize(keyWorker.firstName)} ${capitalize(
        keyWorker.lastName,
      )}`,
      lastMeeting: 'Unavailable',
    };
  }

  async function getVisitsFor(bookingId) {
    const lastVisit = await repository.getLastVisitFor(bookingId);
    const nextVisit = await repository.getNextVisitFor(bookingId);

    return {
      lastVisit: prettyDate(prop('startTime', lastVisit)),
      nextVisit: prettyDate(prop('startTime', nextVisit)),
    };
  }

  async function getImportantDatesFor(bookingId) {
    const sentenceDetails = await repository.sentenceDetailsFor(bookingId);

    return {
      reCategorisationDate: 'Unavailable',
      hdcEligibilityDate: prettyDate(
        prop('homeDetentionCurfewEligibilityDate', sentenceDetails),
      ),
      conditionalReleaseDate: prettyDate(
        prop('conditionalReleaseDate', sentenceDetails),
      ),
      licenceExpiryDate: prettyDate(prop('licenceExpiryDate', sentenceDetails)),
    };
  }

  async function getEventsForToday(bookingId) {
    const noEvents = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    if (!bookingId) return noEvents;

    const events = await repository.getEventsForToday(bookingId);

    if (!Array.isArray(events)) return noEvents;

    return {
      morning: getEventsForTimeOfDay(events, 'morning'),
      afternoon: getEventsForTimeOfDay(events, 'afternoon'),
      evening: getEventsForTimeOfDay(events, 'evening'),
    };
  }

  return {
    getOffenderDetailsFor,
    getIEPSummaryFor,
    getBalancesFor,
    getKeyWorkerFor,
    getVisitsFor,
    getImportantDatesFor,
    getEventsForToday,
  };
};
