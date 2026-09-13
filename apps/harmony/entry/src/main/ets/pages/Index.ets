import { common } from '@kit.AbilityKit';
import { webview } from '@kit.ArkWeb';
import { formProvider } from '@kit.FormKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { NativeState, QingdanState } from '../common/NativeState';

interface StateBridgeMessage {
  type: string;
  state?: QingdanState;
}

interface NativeStateMessage {
  type: string;
  stateJson: string;
}

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  private ports: webview.WebMessagePort[] = [];

  private abilityContext(): common.UIAbilityContext {
    return this.getUIContext().getHostContext() as common.UIAbilityContext;
  }

  private closeBridge(): void {
    this.ports.forEach((port: webview.WebMessagePort): void => {
      try {
        port.close();
      } catch (_) {
        // The system may already have closed a port while the page was reloading.
      }
    });
    this.ports = [];
  }

  private sendStoredState(): void {
    if (this.ports.length !== 2) return;
    const context = this.abilityContext();
    const response: NativeStateMessage = {
      type: 'state',
      stateJson: NativeState.read(context)
    };
    try {
      this.ports[1].postMessageEvent(JSON.stringify(response));
    } catch (_) {
      // The page may have been reloaded while native state was being prepared.
    }
  }

  private handleWebMessage(result: webview.WebMessage): void {
    if (typeof result !== 'string') return;
    try {
      const message = JSON.parse(result) as StateBridgeMessage;
      if (message.type === 'ready') {
        this.sendStoredState();
        return;
      }
      if (message.type !== 'state' || !message.state) return;
      const context = this.abilityContext();
      NativeState.write(context, JSON.stringify(message.state)).then((): void => {
        formProvider.reloadAllForms(context).catch((_error: BusinessError): void => {
          // No card has been added yet, or the host is temporarily unavailable.
        });
      }).catch((_error: BusinessError): void => {
        // The web copy remains intact and will retry on the next state change.
      });
    } catch (_) {
      // Ignore malformed bridge messages rather than interrupting the app UI.
    }
  }

  private connectBridge(): void {
    this.closeBridge();
    try {
      this.ports = this.controller.createWebMessagePorts();
      if (this.ports.length !== 2) return;
      this.ports[1].onMessageEvent((result: webview.WebMessage): void => {
        this.handleWebMessage(result);
      });
      this.controller.postMessage('__qingdan_harmony_port__', [this.ports[0]], '*');
    } catch (_) {
      this.closeBridge();
    }
  }

  aboutToDisappear(): void {
    this.closeBridge();
  }

  build() {
    Column() {
      Web({
        src: $rawfile('web/index.html'),
        controller: this.controller
      })
        .width('100%')
        .height('100%')
        .backgroundColor('#F7F7F4')
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(true)
        .imageAccess(true)
        .onlineImageAccess(true)
        .onPageEnd((): void => {
          this.connectBridge();
        })
    }
    .width('100%')
    .height('100%')
  }
}
