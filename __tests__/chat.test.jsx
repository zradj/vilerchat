import 'core-js/stable/index.js';
import 'regenerator-runtime/runtime.js';

import _ from 'lodash';
import {
  act, render, screen, waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import httpAdapter from 'axios/lib/adapters/http.js';
import nock from 'nock';
import MockedSocket from 'socket.io-mock';
import '@testing-library/jest-dom/extend-expect.js';

import init from '../src/init.jsx';
import routes from '../src/routes.js';

axios.defaults.adapter = httpAdapter;

const token = 'random-token';
const data = {
  channels: [
    { id: 1, name: 'channel1', removable: false },
    { id: 2, name: 'channel2', removable: true },
  ],
  currentChannelId: 1,
  messages: [],
};

const getDataScope = () => (
  nock('http://localhost', { reqheaders: { Authorization: `Bearer ${token}` } })
    .get(routes.data())
    .reply(200, data)
);

describe('Channels', () => {
  let socket;

  beforeEach(async () => {
    nock('http://localhost')
      .post(routes.login(), { username: 'user', password: 'pass' })
      .reply(200, { token, username: 'random' });

    socket = new MockedSocket();

    const vdom = await init(socket.socketClient);

    render(vdom);

    await act(async () => {
      userEvent.type(await screen.findByLabelText(/Your nickname/i), 'user');
      userEvent.type(await screen.findByLabelText(/Password/i), 'pass');

      userEvent.click(await screen.findByRole('button', { name: 'Log in' }));
    });
  });

  test('Must show channels properly', async () => {
    const scope = getDataScope();

    await waitFor(() => {
      expect(scope.isDone()).toBe(true);
    });

    expect(await screen.findByRole('button', { name: 'channel1' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'channel2' })).toBeInTheDocument();
  });

  test('Add channels', async () => {
    getDataScope();

    socket.on('newChannel', (channel, ack) => {
      socket.emit('newChannel', {
        ...channel,
        removable: true,
        id: _.uniqueId(),
      });

      ack({ status: 'ok' });
    });

    expect(await screen.findByRole('button', { name: '+' })).toBeInTheDocument();

    await act(async () => {
      userEvent.click(await screen.findByRole('button', { name: '+' }));
    });

    const modal = await screen.findByRole('dialog');
    expect(modal).toBeInTheDocument();

    await act(async () => {
      userEvent.type(await screen.findByTestId('add-channel'), 'new-channel');
      userEvent.click(await screen.findByRole('button', { name: 'Add' }));
    });

    await waitFor(() => expect(modal).not.toBeInTheDocument());

    expect(await screen.findByRole('button', { name: 'new-channel' })).toBeInTheDocument();
  });
});