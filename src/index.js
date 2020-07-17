import { Store, installStore } from './store';
import {
  mapState, mapMutations, mapGetters, mapActions, createNamespacedHelpers,
} from './helpers';

export default {
  Store,
  installStore,
  version: '__VERSION__',
  mapState,
  mapMutations,
  mapGetters,
  mapActions,
  createNamespacedHelpers,
};
