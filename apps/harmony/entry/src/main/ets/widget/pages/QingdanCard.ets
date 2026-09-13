import { CardItem, CardPage, CardPayload } from '../../common/NativeState';

const cardStorage = new LocalStorage();

@Entry(cardStorage)
@Component
struct QingdanCard {
  @LocalStorageProp('payload') payload: string = '{"pages":[]}';
  @State selectedIndex: number = 0;

  private pages(): CardPage[] {
    try {
      const value = JSON.parse(this.payload) as CardPayload;
      return Array.isArray(value.pages) ? value.pages : [];
    } catch (_) {
      return [];
    }
  }

  private currentPage(): CardPage {
    const pages = this.pages();
    if (pages.length === 0) return { key: 'todo', label: '待办', items: [] };
    const safeIndex = this.selectedIndex >= 0 && this.selectedIndex < pages.length ? this.selectedIndex : 0;
    return pages[safeIndex];
  }

  private itemDetail(item: CardItem, pageKey: string, index: number): string {
    const details: string[] = [];
    if (pageKey === 'memo') details.push(`第 ${index + 1} 条`);
    if (item.pinned) details.push('已置顶');
    if (item.node) details.push(item.node.replace('T', ' '));
    if (item.notes) details.push('有备注');
    return details.join(' · ');
  }

  private priorityColor(priority: string): string {
    if (priority === 'important') return '#D95C52';
    if (priority === 'normal') return '#D8A12F';
    return '#9DA29B';
  }

  private openApp(pageKey: string): void {
    postCardAction(this, {
      action: 'router',
      abilityName: 'EntryAbility',
      params: { view: pageKey }
    });
  }

  private complete(item: CardItem, pageKey: string): void {
    postCardAction(this, {
      action: 'message',
      params: {
        action: 'complete',
        page: pageKey,
        id: item.id
      }
    });
  }

  build() {
    Column() {
      Row() {
        Text('清单')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor('#252824')
          .onClick((): void => this.openApp(this.currentPage().key))
        Blank()
        Text(`${this.currentPage().label} ${this.currentPage().items.length}`)
          .fontSize(13)
          .fontColor('#737970')
      }
      .width('100%')
      .height(30)

      Row({ space: 5 }) {
        ForEach(this.pages(), (page: CardPage, index: number) => {
          Text(page.label)
            .fontSize(12)
            .fontWeight(index === this.selectedIndex ? FontWeight.Medium : FontWeight.Regular)
            .fontColor(index === this.selectedIndex ? '#FFFFFF' : '#596057')
            .textAlign(TextAlign.Center)
            .layoutWeight(1)
            .height(28)
            .borderRadius(14)
            .backgroundColor(index === this.selectedIndex ? '#65735F' : '#E9ECE6')
            .onClick((): void => {
              this.selectedIndex = index;
            })
        }, (page: CardPage): string => page.key)
      }
      .width('100%')
      .margin({ top: 8, bottom: 8 })

      Divider()
        .color('#E0E4DD')
        .strokeWidth(1)

      if (this.currentPage().items.length === 0) {
        Column({ space: 8 }) {
          Text('✓')
            .fontSize(30)
            .fontColor('#A5ADA1')
          Text(this.currentPage().key === 'schedule' ? '今天没有日程' : `还没有${this.currentPage().label}`)
            .fontSize(14)
            .fontColor('#737970')
        }
        .layoutWeight(1)
        .width('100%')
        .justifyContent(FlexAlign.Center)
      } else {
        List({ space: 5 }) {
          ForEach(this.currentPage().items, (item: CardItem, index: number) => {
            ListItem() {
              Row({ space: 8 }) {
                if (this.currentPage().key !== 'memo') {
                  Text('○')
                    .fontSize(22)
                    .fontColor('#788274')
                    .width(28)
                    .height(36)
                    .textAlign(TextAlign.Center)
                    .onClick((): void => this.complete(item, this.currentPage().key))
                } else {
                  Text(`${index + 1}`)
                    .fontSize(12)
                    .fontColor('#FFFFFF')
                    .width(22)
                    .height(22)
                    .borderRadius(11)
                    .backgroundColor(item.pinned ? '#65735F' : '#A4AAA1')
                    .textAlign(TextAlign.Center)
                }

                Column({ space: 2 }) {
                  Row({ space: 6 }) {
                    Text(item.title)
                      .fontSize(14)
                      .fontWeight(FontWeight.Medium)
                      .fontColor('#2F332E')
                      .maxLines(1)
                      .textOverflow({ overflow: TextOverflow.Ellipsis })
                      .layoutWeight(1)
                    if (this.currentPage().key !== 'memo') {
                      Text('●')
                        .fontSize(9)
                        .fontColor(this.priorityColor(item.priority))
                    }
                  }
                  .width('100%')

                  if (this.itemDetail(item, this.currentPage().key, index)) {
                    Text(this.itemDetail(item, this.currentPage().key, index))
                      .fontSize(10)
                      .fontColor('#8A9087')
                      .maxLines(1)
                      .textOverflow({ overflow: TextOverflow.Ellipsis })
                  }
                }
                .layoutWeight(1)
                .alignItems(HorizontalAlign.Start)
                .onClick((): void => this.openApp(this.currentPage().key))
              }
              .width('100%')
              .padding({ left: 8, right: 10, top: 5, bottom: 5 })
              .borderRadius(10)
              .backgroundColor('#FFFFFF')
            }
          }, (item: CardItem): string => item.id)
        }
        .layoutWeight(1)
        .width('100%')
        .scrollBar(BarState.Auto)
        .edgeEffect(EdgeEffect.Spring)
        .margin({ top: 8 })
      }
    }
    .width('100%')
    .height('100%')
    .padding(14)
    .backgroundColor('#F5F6F2')
  }
}
