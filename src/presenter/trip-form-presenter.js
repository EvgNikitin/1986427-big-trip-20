import TripInfoView from '../view/trip-info-view.js';
import RoutePointListView from '../view/route-point-list-view.js';
import NoRoutePointView from '../view/no-route-point-view.js';
import SortView from '../view/sort-view.js';
import BigTripView from '../view/big-trip-view.js';
import LoadingView from '../view/loading-view.js';
import NewRoutePointButtonView from '../view/new-route-point-button-view.js';
import NotAvailableView from '../view/not-available-view.js';
import RoutePointPresenter from './route-point-presenter.js';
import NewRoutePointPresenter from './new-route-point-presenter.js';
import {render, RenderPosition, remove} from '../framework/render.js';
import UiBlocker from '../framework/ui-blocker/ui-blocker.js';
import { sortByDay, sortByDurationTime, sortByPrice } from '../utils/route-point-utils.js';
import {SortType, UpdateType, UserAction, FilterType, TimeLimit} from '../const.js';
import {filter} from '../utils/common.js';

export default class TripFormPresenter {
  #tripInfoComponent = null;
  #bigTripComponent = new BigTripView();
  #tripInfoContainer = null;
  #bigTripContainer = null;
  #routePointsModel = null;
  #destinationsModel = null;
  #offersModel = null;
  #filterModel = null;
  #routePointListComponent = new RoutePointListView();
  #newRoutePointButtonComponent = null;
  #loadingComponent = new LoadingView();
  #notAvailableComponent = new NotAvailableView();
  #sortComponent = null;
  #noRoutePointComponent = null;
  #routePointsPresenters = new Map();
  #newRoutePointPresenter = null;
  #currentSortType = SortType.DEFAULT;
  #filterType = FilterType.EVERYTHING;
  #areDestinationsLoaded = false;
  #areOffersLoaded = false;
  #areRoutePointsLoaded = false;
  #isLoading = true;
  #showErrorMessage = false;
  #isCreated = false;
  #uiBlocker = new UiBlocker({
    lowerLimit: TimeLimit.LOWER_LIMIT,
    upperLimit: TimeLimit.UPPER_LIMIT
  });

  constructor({
    bigTripContainer,
    tripInfoContainer,
    routePointsModel,
    destinationsModel,
    offersModel,
    filterModel
  }) {
    this.#bigTripContainer = bigTripContainer;
    this.#tripInfoContainer = tripInfoContainer;
    this.#routePointsModel = routePointsModel;
    this.#destinationsModel = destinationsModel;
    this.#offersModel = offersModel;
    this.#filterModel = filterModel;

    this.#routePointsModel.addObserver(this.#handleModelEvent);
    this.#destinationsModel.addObserver(this.#handleModelEvent);
    this.#offersModel.addObserver(this.#handleModelEvent);
    this.#filterModel.addObserver(this.#handleModelEvent);

    const handleNewRoutePointButtonClick = () => {
      this.#isCreated = true;
      this.createRoutePoint();
      this.#newRoutePointButtonComponent.element.disabled = true;
    };

    this.#newRoutePointButtonComponent = new NewRoutePointButtonView({
      onClick: handleNewRoutePointButtonClick
    });

    const handleNewRoutePointFormClose = () => {
      this.#isCreated = false;
      this.#newRoutePointButtonComponent.element.disabled = false;
      if (this.routePoints.length === 0) {
        this.#renderNoRoutePoints();
        remove(this.#sortComponent);
      }
    };

    this.#newRoutePointPresenter = new NewRoutePointPresenter({
      routePointListContainer: this.#routePointListComponent.element,
      destinationsModel: this.#destinationsModel,
      offersModel: this.#offersModel,
      onDataChange: this.#handleViewAction,
      onDestroy: handleNewRoutePointFormClose
    });
  }

  get routePoints() {
    this.#filterType = this.#filterModel.filter;
    const routePoints = this.#routePointsModel.routePoints;
    const filteredRoutePoints = filter[this.#filterType](routePoints);

    if (this.#currentSortType === SortType.DURATION_TIME) {
      return filteredRoutePoints.sort(sortByDurationTime);
    }
    if (this.#currentSortType === SortType.PRICE) {
      return filteredRoutePoints.sort(sortByPrice);
    }
    if (this.#currentSortType === SortType.DEFAULT) {
      return filteredRoutePoints.sort(sortByDay);
    }

    return filteredRoutePoints;
  }

  init() {
    this.#renderBigTrip();
  }

  createRoutePoint() {
    this.#currentSortType = SortType.DEFAULT;
    this.#filterModel.setFilter(
      UpdateType.MAJOR,
      FilterType.EVERYTHING
    );
    this.#newRoutePointPresenter.init();
  }

  #renderTripInfo() {
    const routePoints = [
      ...this.#routePointsModel.routePoints
    ].sort(sortByDay);

    if (!routePoints.length) {
      return '';
    }
    this.#tripInfoComponent = new TripInfoView(
      routePoints,
      this.#destinationsModel.destinations,
      this.#offersModel.offers
    );
    render(
      this.#tripInfoComponent,
      this.#tripInfoContainer,
      RenderPosition.AFTERBEGIN
    );
  }

  #renderSort() {
    this.#sortComponent = new SortView({
      currentSortType: this.#currentSortType,
      onSortTypeChange: this.#handleSortTypeChange
    });
    render(
      this.#sortComponent,
      this.#bigTripComponent.element,
      RenderPosition.AFTERBEGIN
    );
  }

  #renderLoading() {
    render(
      this.#loadingComponent,
      this.#bigTripComponent.element,
      RenderPosition.AFTERBEGIN
    );
  }

  #renderServerNotAvailableMessage() {
    this.#showErrorMessage = true;
    render(
      this.#notAvailableComponent,
      this.#bigTripComponent.element,
      RenderPosition.AFTERBEGIN
    );
  }

  #renderNoRoutePoints() {
    this.#noRoutePointComponent = new NoRoutePointView({
      filterType: this.#filterType
    });
    if (!this.#showErrorMessage) {
      render(
        this.#noRoutePointComponent,
        this.#bigTripComponent.element,
        RenderPosition.AFTERBEGIN
      );
    }
  }

  #clearTripForm({resetSortType = false} = {}) {
    remove(this.#tripInfoComponent);
    this.#newRoutePointPresenter.destroy();

    this.#routePointsPresenters.forEach((presenter) => presenter.destroy());
    this.#routePointsPresenters.clear();

    remove(this.#sortComponent);
    remove(this.#loadingComponent);

    if (this.#noRoutePointComponent) {
      remove(this.#noRoutePointComponent);
    }
    if (this.#notAvailableComponent) {
      remove(this.#notAvailableComponent);
    }
    if (resetSortType) {
      this.#currentSortType = SortType.DEFAULT;
    }
  }

  #renderRoutePoints(){
    this.routePoints.forEach((routePoint) => this.#renderRoutePoint(routePoint));
  }

  #renderRoutePoint(routePoint) {
    const routePointPresenter = new RoutePointPresenter({
      routePointListContainer: this.#routePointListComponent.element,
      destinationsModel: this.#destinationsModel,
      routePointsModel: this.#routePointsModel,
      offersModel: this.#offersModel,
      onDataChange: this.#handleViewAction,
      onModeChange: this.#handleModeChange
    });
    routePointPresenter.init(routePoint);
    this.#routePointsPresenters.set(routePoint.id, routePointPresenter);
  }

  #renderBigTrip(){
    render(this.#bigTripComponent, this.#bigTripContainer);
    this.#renderTripInfo();
    render(this.#newRoutePointButtonComponent, this.#tripInfoContainer);

    if (this.#isLoading) {
      this.#renderLoading();
      return;
    }
    if (
      this.routePoints.length === 0
      && !this.#showErrorMessage
      && !this.#isCreated
    ) {
      this.#renderNoRoutePoints();
      return;
    }
    if (this.#showErrorMessage) {
      this.#newRoutePointButtonComponent.element.disabled = true;
      this.#renderServerNotAvailableMessage();
      return;
    }
    this.#renderSort();
    render(
      this.#routePointListComponent,
      this.#bigTripComponent.element
    );
    this.#renderRoutePoints();
  }

  #handleModeChange = () => {
    this.#newRoutePointPresenter.destroy();
    this.#routePointsPresenters.forEach((presenter) => presenter.resetView());
  };

  #handleViewAction = async (
    actionType,
    updateType,
    update
  ) => {
    this.#uiBlocker.block();

    if (actionType === UserAction.UPDATE_ROUTEPOINT) {
      this.#routePointsPresenters.get(update.id).setSaving();
      try {
        await this.#routePointsModel.updateRoutePoint(
          updateType,
          update
        );
      } catch(err) {
        this.#routePointsPresenters.get(update.id).setAborting();
      }
    }

    if (actionType === UserAction.ADD_ROUTEPOINT) {
      this.#newRoutePointPresenter.setSaving();
      try {
        await this.#routePointsModel.addRoutePoint(
          updateType,
          update
        );
      } catch(err) {
        this.#newRoutePointPresenter.setAborting();
      }
    }

    if (actionType === UserAction.DELETE_ROUTEPOINT) {
      this.#routePointsPresenters.get(update.id).setDeleting();
      try {
        await this.#routePointsModel.deleteRoutePoint(
          updateType,
          update
        );
      } catch(err) {
        this.#routePointsPresenters.get(update.id).setAborting();
      }
    }

    this.#uiBlocker.unblock();
  };

  #handleModelEvent = (updateType, data) => {
    if (updateType === UpdateType.PATCH) {
      this.#routePointsPresenters.get(data.id).init(data);
      remove(this.#tripInfoComponent);
      this.#renderTripInfo();
    }
    if (updateType === UpdateType.MINOR) {
      this.#clearTripForm();
      this.#renderBigTrip();
    }
    if (updateType === UpdateType.MAJOR) {
      this.#clearTripForm({resetSortType: true});
      this.#renderBigTrip();
    }
    if (updateType === UpdateType.DESTINATIONS) {
      this.#areDestinationsLoaded = true;
    }
    if (updateType === UpdateType.OFFERS) {
      this.#areOffersLoaded = true;
    }
    if (updateType === UpdateType.ROUTEPOINTS) {
      this.#areRoutePointsLoaded = true;
    }
    if (updateType === UpdateType.INIT) {
      if (
        !this.#areDestinationsLoaded
          || !this.#areOffersLoaded
          || !this.#areRoutePointsLoaded
      ) {
        return;
      }
      this.#isLoading = false;
      remove(this.#loadingComponent);
      this.#clearTripForm();
      this.#renderBigTrip();
    }
    if (updateType === UpdateType.INIT) {
      this.#isLoading = false;
      this.#showErrorMessage = true;
      remove(this.#loadingComponent);
      this.#clearTripForm();
      this.#renderBigTrip();
    }
  };

  #handleSortTypeChange = (sortType) => {
    if (this.#currentSortType === sortType) {
      return;
    }
    this.#currentSortType = sortType;
    this.#clearTripForm();
    this.#renderBigTrip();
  };

}
