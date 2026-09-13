import { Want } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { formBindingData, FormExtensionAbility, formInfo, formProvider } from '@kit.FormKit';
import { buildCardPayload, completeCardItem, NativeState } from '../common/NativeState';

interface CardAction {
  action?: string;
  page?: string;
  id?: string;
}

class CardBindingData {
  payload: string;

  constructor(payload: string) {
    this.payload = payload;
  }
}

function bindingFor(stateJson: string): formBindingData.FormBindingData {
  return formBindingData.createFormBindingData(new CardBindingData(buildCardPayload(stateJson)));
}

export default class QingdanFormAbility extends FormExtensionAbility {
  onAddForm(_want: Want): formBindingData.FormBindingData {
    return bindingFor(NativeState.read(this.context));
  }

  onUpdateForm(formId: string): void {
    formProvider.updateForm(formId, bindingFor(NativeState.read(this.context)))
      .catch((_error: BusinessError): void => {
        // The host may remove a card while an update is in flight.
      });
  }

  onFormEvent(formId: string, message: string): void {
    try {
      const action = JSON.parse(message) as CardAction;
      if (action.action !== 'complete' || !action.page || !action.id) return;
      const previous = NativeState.read(this.context);
      const next = completeCardItem(previous, action.page, action.id);
      if (next === previous) return;
      NativeState.write(this.context, next).then((): void => {
        formProvider.updateForm(formId, bindingFor(next)).catch((_error: BusinessError): void => {
          // The host may remove a card while an update is in flight.
        });
      }).catch((_error: BusinessError): void => {
        // Keep the current card state when persistence fails.
      });
    } catch (_) {
      // Ignore malformed card events.
    }
  }

  onAcquireFormState(_want: Want): formInfo.FormState {
    return formInfo.FormState.READY;
  }
}
