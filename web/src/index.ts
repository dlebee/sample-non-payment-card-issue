import './styles/style.scss';
import * as $ from 'jquery';
import { Application } from './application';

const $app = $('#app');
const application = new Application($app);
application.run();
