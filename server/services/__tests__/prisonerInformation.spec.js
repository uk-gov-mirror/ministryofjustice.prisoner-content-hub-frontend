const Sentry = require('@sentry/node');
const { PrisonerInformationService } = require('../prisonerInformation');
const { User } = require('../../auth/user');

jest.mock('@sentry/node');

describe('PrisonerInformation', () => {
  let prisonApiRepository = {};

  const user = new User({
    prisonerId: 'PRISONER_ID',
    firstName: 'Test',
    surname: 'User',
    bookingId: 'BOOKING_ID',
  });

  const transactions = [
    {
      paymentDate: '2021-01-03',
      postingType: 'CR',
      penceAmount: 10,
      currency: 'GBP',
      balance: 30,
      entryDescription: 'Received some money',
      agencyId: 'TST',
    },
    {
      paymentDate: '2021-01-02',
      postingType: 'CR',
      penceAmount: 10,
      currency: 'GBP',
      balance: 20,
      entryDescription: 'Received some money',
      agencyId: 'TST',
    },
    {
      paymentDate: '2021-01-01',
      postingType: 'CR',
      penceAmount: 10,
      currency: 'GBP',
      balance: 10,
      entryDescription: 'Received some money',
      agencyId: 'TST',
    },
  ];

  const balances = {
    spends: 123,
    cash: 456,
    savings: 789,
    currency: 'GBP',
  };

  const prisons = [
    {
      agencyId: 'TST',
      description: 'Test (HMP)',
      formattedDescription: 'Test (HMP)',
    },
    {
      agencyId: 'TST2',
      description: 'Test 2 (HMP)',
      formattedDescription: 'Test 2 (HMP)',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    prisonApiRepository = {
      getTransactionsFor: jest.fn(),
      getBalancesFor: jest.fn(),
      getPrisonDetails: jest.fn(),
    };
  });

  describe('getTransactionInformationFor', () => {
    it('returns transaction data', async () => {
      const prisonerInformationService = new PrisonerInformationService({
        prisonApiRepository,
      });

      prisonApiRepository.getTransactionsFor.mockResolvedValue(transactions);
      prisonApiRepository.getBalancesFor.mockResolvedValue(balances);
      prisonApiRepository.getPrisonDetails.mockResolvedValue(prisons);

      const data = await prisonerInformationService.getTransactionInformationFor(
        user,
        'spends',
        new Date('2021-01-01'),
        new Date('2021-01-01'),
      );

      expect(data).toHaveProperty('transactions');
      expect(data.transactions.length).toBe(3);
      expect(data.transactions[0]).toEqual({
        paymentDate: '2021-01-03',
        postingType: 'CR',
        penceAmount: 10,
        currency: 'GBP',
        balance: 30,
        entryDescription: 'Received some money',
        agencyId: 'TST',
        prison: 'Test (HMP)',
      });
    });

    it('returns default to using the agencyId for prison name when unable to find a match', async () => {
      const prisonerInformationService = new PrisonerInformationService({
        prisonApiRepository,
      });

      prisonApiRepository.getTransactionsFor.mockResolvedValue(transactions);
      prisonApiRepository.getBalancesFor.mockResolvedValue(balances);
      prisonApiRepository.getPrisonDetails.mockResolvedValue([]);

      const data = await prisonerInformationService.getTransactionInformationFor(
        user,
        'spends',
        new Date('2021-01-01'),
        new Date('2021-01-01'),
      );

      expect(data).toHaveProperty('transactions');
      expect(data.transactions.length).toBe(3);
      expect(data.transactions[0]).toEqual({
        paymentDate: '2021-01-03',
        postingType: 'CR',
        penceAmount: 10,
        currency: 'GBP',
        balance: 30,
        entryDescription: 'Received some money',
        agencyId: 'TST',
        prison: 'TST',
      });
    });

    it('returns a notification when unable to fetch transaction data', async () => {
      const prisonerInformationService = new PrisonerInformationService({
        prisonApiRepository,
      });

      prisonApiRepository.getTransactionsFor.mockResolvedValue(null);
      prisonApiRepository.getBalancesFor.mockResolvedValue(balances);
      prisonApiRepository.getPrisonDetails.mockResolvedValue(prisons);

      const data = await prisonerInformationService.getTransactionInformationFor(
        user,
        'spends',
        new Date('2021-01-01'),
        new Date('2021-01-01'),
      );

      expect(data).toHaveProperty('transactions');
      expect(data.transactions).toHaveProperty('error');
    });

    it('returns balance data', async () => {
      const prisonerInformationService = new PrisonerInformationService({
        prisonApiRepository,
      });

      prisonApiRepository.getTransactionsFor.mockResolvedValue(transactions);
      prisonApiRepository.getBalancesFor.mockResolvedValue(balances);
      prisonApiRepository.getPrisonDetails.mockResolvedValue(prisons);

      const data = await prisonerInformationService.getTransactionInformationFor(
        user,
        'spends',
        new Date('2021-01-01'),
        new Date('2021-01-01'),
      );

      expect(data).toHaveProperty('balances');
      expect(data.balances).toEqual(balances);
    });

    it('returns a notification when unable to fetch balance data', async () => {
      const prisonerInformationService = new PrisonerInformationService({
        prisonApiRepository,
      });

      prisonApiRepository.getTransactionsFor.mockResolvedValue(transactions);
      prisonApiRepository.getBalancesFor.mockResolvedValue(null);
      prisonApiRepository.getPrisonDetails.mockResolvedValue(prisons);

      const data = await prisonerInformationService.getTransactionInformationFor(
        user,
        'spends',
        new Date('2021-01-01'),
        new Date('2021-01-01'),
      );

      expect(data).toHaveProperty('balances');
      expect(data.balances).toHaveProperty('error');
    });

    it('throws when called without a user', async () => {
      const prisonerInformationService = new PrisonerInformationService({
        prisonApiRepository,
      });

      prisonApiRepository.getTransactionsFor.mockResolvedValue(transactions);
      prisonApiRepository.getBalancesFor.mockResolvedValue(balances);
      prisonApiRepository.getPrisonDetails.mockResolvedValue(prisons);

      await expect(
        prisonerInformationService.getTransactionInformationFor(
          null,
          'spends',
          new Date('2021-01-01'),
          new Date('2021-01-01'),
        ),
      ).rejects.toThrow();

      expect(prisonApiRepository.getTransactionsFor).not.toHaveBeenCalled();
      expect(prisonApiRepository.getBalancesFor).not.toHaveBeenCalled();
      expect(prisonApiRepository.getPrisonDetails).not.toHaveBeenCalled();
    });

    it('throws when called without an account code', async () => {
      const prisonerInformationService = new PrisonerInformationService({
        prisonApiRepository,
      });

      prisonApiRepository.getTransactionsFor.mockResolvedValue(transactions);
      prisonApiRepository.getBalancesFor.mockResolvedValue(balances);
      prisonApiRepository.getPrisonDetails.mockResolvedValue(prisons);

      await expect(
        prisonerInformationService.getTransactionInformationFor(
          user,
          null,
          new Date('2021-01-01'),
          new Date('2021-01-01'),
        ),
      ).rejects.toThrow();

      expect(prisonApiRepository.getTransactionsFor).not.toHaveBeenCalled();
      expect(prisonApiRepository.getBalancesFor).not.toHaveBeenCalled();
      expect(prisonApiRepository.getPrisonDetails).not.toHaveBeenCalled();
    });

    it('throws when called without a from-date', async () => {
      const prisonerInformationService = new PrisonerInformationService({
        prisonApiRepository,
      });

      prisonApiRepository.getTransactionsFor.mockResolvedValue(transactions);
      prisonApiRepository.getBalancesFor.mockResolvedValue(balances);
      prisonApiRepository.getPrisonDetails.mockResolvedValue(prisons);

      await expect(
        prisonerInformationService.getTransactionInformationFor(
          user,
          'spends',
          null,
          new Date('2021-01-01'),
        ),
      ).rejects.toThrow();

      expect(prisonApiRepository.getTransactionsFor).not.toHaveBeenCalled();
      expect(prisonApiRepository.getBalancesFor).not.toHaveBeenCalled();
      expect(prisonApiRepository.getPrisonDetails).not.toHaveBeenCalled();
    });

    it('throws when called without a to-date', async () => {
      const prisonerInformationService = new PrisonerInformationService({
        prisonApiRepository,
      });

      prisonApiRepository.getTransactionsFor.mockResolvedValue(transactions);
      prisonApiRepository.getBalancesFor.mockResolvedValue(balances);
      prisonApiRepository.getPrisonDetails.mockResolvedValue(prisons);

      await expect(
        prisonerInformationService.getTransactionInformationFor(
          user,
          'spends',
          new Date('2021-01-01'),
          null,
        ),
      ).rejects.toThrow();

      expect(prisonApiRepository.getTransactionsFor).not.toHaveBeenCalled();
      expect(prisonApiRepository.getBalancesFor).not.toHaveBeenCalled();
      expect(prisonApiRepository.getPrisonDetails).not.toHaveBeenCalled();
    });

    it('swallows the exception and return null if an error is thrown getting transactions', async () => {
      const prisonerInformationService = new PrisonerInformationService({
        prisonApiRepository,
      });

      prisonApiRepository.getTransactionsFor.mockRejectedValue('💥');
      prisonApiRepository.getBalancesFor.mockResolvedValue(balances);
      prisonApiRepository.getPrisonDetails.mockResolvedValue(prisons);

      const result = await prisonerInformationService.getTransactionInformationFor(
        user,
        'spends',
        new Date('2021-01-01'),
        new Date('2021-01-01'),
      );

      expect(Sentry.captureException).toHaveBeenCalledWith('💥');
      expect(result).toBeNull();
    });

    it('swallows the exception and return null if an error is thrown getting balances', async () => {
      const prisonerInformationService = new PrisonerInformationService({
        prisonApiRepository,
      });

      prisonApiRepository.getTransactionsFor.mockResolvedValue(transactions);
      prisonApiRepository.getBalancesFor.mockRejectedValue('💥');
      prisonApiRepository.getPrisonDetails.mockResolvedValue(prisons);

      const result = await prisonerInformationService.getTransactionInformationFor(
        user,
        'spends',
        new Date('2021-01-01'),
        new Date('2021-01-01'),
      );

      expect(Sentry.captureException).toHaveBeenCalledWith('💥');
      expect(result).toBeNull();
    });

    it('swallows the exception and return null if an error is thrown getting prison details', async () => {
      const prisonerInformationService = new PrisonerInformationService({
        prisonApiRepository,
      });

      prisonApiRepository.getTransactionsFor.mockResolvedValue(transactions);
      prisonApiRepository.getBalancesFor.mockResolvedValue(balances);
      prisonApiRepository.getPrisonDetails.mockRejectedValue('💥');

      const result = await prisonerInformationService.getTransactionInformationFor(
        user,
        'spends',
        new Date('2021-01-01'),
        new Date('2021-01-01'),
      );

      expect(Sentry.captureException).toHaveBeenCalledWith('💥');
      expect(result).toBeNull();
    });
  });
});
