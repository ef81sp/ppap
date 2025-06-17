import { Browser as _Browser } from 'playwright';
import { assertEquals, assertExists } from 'std/assert/mod.ts';
import {
  setupBrowser,
  createPage,
  isServerRunning,
  cleanupKVStore,
} from './helpers.ts';
// Testing Libraryをインポート（存在しないインポートを削除）
import { queries, getDocument } from 'playwright-testing-library';

// テストをグループ化してリソースを適切に管理
Deno.test('ルーム機能のテスト', async t => {
  // テスト開始前にサーバーが起動しているか確認
  await t.step('サーバー接続確認', async () => {
    const server = await isServerRunning();
    if (!server) {
      throw new Error(
        'テスト実行前にサーバーを起動してください: deno task serve'
      );
    }
  });

  // テスト開始前にKVストアをクリーンアップ
  await cleanupKVStore();

  // テスト用のブラウザを一度だけ起動
  const browser = await setupBrowser();
  let roomUrl = '';

  // 最初にルームを作成
  await t.step('テスト用のルームを作成', async () => {
    const { page, context: _context } = await createPage(browser);

    try {
      console.log('トップページにアクセスしました');

      // Testing Libraryを使って名前入力と送信
      const $document = await getDocument(page);
      const $nameInput = await queries.getByRole($document, 'textbox');
      await $nameInput.fill('HostUser');
      const $createButton = await queries.getByRole($document, 'button');
      await $createButton.click();

      console.log('ホストユーザーとしてルームを作成しました');

      // URLが変わるのを待つ (ルームに遷移したことを確認)
      await page.waitForURL(/\/#\/[a-z0-9\-]+/);
      console.log('ルームページに移動しました');

      // URLを取得 (Copy URLボタンを押した場合のURLと同等)
      roomUrl = page.url();
      console.log('ルームURL:', roomUrl);

      // Copy URLボタンが表示されるのを待つ
      const $newDocument = await getDocument(page);
      await queries.getByRole($newDocument, 'button', { name: /copy URL/i });
      console.log('Copy URLボタンが表示されました');

      // ルームを作成したら画面は閉じずに、このページをホストとして維持する
    } finally {
      // ページもコンテキストも閉じない - ルームを維持するため
    }
  });

  // 別のユーザーがルームに参加できることを確認
  await t.step('別のユーザーがルームに参加できること', async () => {
    console.log('ゲストユーザーとして参加を開始します');
    console.log('使用するルームURL:', roomUrl);

    // 2人目のユーザーは、先ほど取得したURLを使用してアクセス
    const { page: guestPage, context: guestContext } = await createPage(
      browser,
      roomUrl
    );

    try {
      // 名前入力フォームが表示されているか確認
      console.log('名前入力フォーム確認中...');
      const $document = await getDocument(guestPage);
      // timeoutオプションを削除し、代わりにwaitForを使用
      const $nameInput = await queries.getByRole($document, 'textbox');
      // 入力フィールドが表示されるまで待機
      await guestPage.waitForTimeout(5000);
      console.log('名前入力フォームが見つかりました');

      // 名前を入力して参加
      await $nameInput.fill('GuestUser');
      const $joinButton = await queries.getByRole($document, 'button');
      await $joinButton.click();
      console.log('ゲストユーザーとして名前を入力し、参加しました');

      // ルームに参加していることを確認（投票オプションが表示されている）
      console.log('投票オプションを待機中...');
      const $newDocument = await getDocument(guestPage);
      // timeoutオプションを削除し、別の方法で待機
      const $voteOption = await queries.getByRole($newDocument, 'button', {
        name: '1',
      });
      assertExists($voteOption, '投票オプションが表示されているか');
      await guestPage.waitForTimeout(5000);
      console.log('投票オプションが表示されました');

      // 少し待機して参加者情報が更新されるのを待つ
      console.log('参加者情報の更新を待機中...');
      await guestPage.waitForTimeout(3000);

      // 参加者カードが表示されるのを待機中
      console.log('参加者カードが表示されるのを待機中...');
      const $articlesDocument = await getDocument(guestPage);
      const $articles = await queries.getAllByRole(
        $articlesDocument,
        'article'
      );

      // 参加者数を確認
      console.log('参加者数を確認します');
      console.log(`参加者数: ${$articles.length}`);

      // 検証: 参加者数は2人（ホストとゲスト）
      assertEquals(
        $articles.length,
        2,
        '参加者数は2人（ホストとゲスト）であるべきです'
      );
      console.log('参加者数の検証に成功しました');
    } finally {
      // ゲストユーザーのページとコンテキストを閉じる
      await guestPage.close();
      await guestContext.close();
    }
  });

  // 投票機能のテスト
  await t.step('投票機能が正しく動作すること', async () => {
    const { page, context: _context } = await createPage(browser, roomUrl);

    try {
      // 名前入力がまだ必要な場合は入力
      let $document = await getDocument(page);
      const $nameInput = await queries.queryByRole($document, 'textbox');

      if ($nameInput) {
        await $nameInput.fill('VoteUser');
        const $joinButton = await queries.getByRole($document, 'button');
        await $joinButton.click();
      }

      // Testing Libraryを使用して投票オプションが表示されるまで待機
      $document = await getDocument(page);
      const $voteButton = await queries.getByText($document, '8');

      // 投票する（「8」を選択）
      await $voteButton.click();

      // 投票後に少し待機して状態の変化を確認できるようにする
      await page.waitForTimeout(1000);

      // テストではボタンが選択されていることを検証
      // evalauteの型エラーを修正
      const buttonElement = await $voteButton.evaluate(el => {
        // HTMLElement型にキャストしてからclassList操作
        return (el as HTMLElement).classList.contains('-translate-y-3');
      });

      assertEquals(buttonElement, true, 'ボタンが選択状態になっているか');
    } finally {
      // 必ずページとコンテキストをクローズ
      await page.close();
      await _context.close();
    }
  });

  // 観戦者モードのテスト
  await t.step('観戦者モードに切り替えられること', async () => {
    const { page, context: _context } = await createPage(browser, roomUrl);

    try {
      // 名前入力がまだ必要な場合は入力
      let $document = await getDocument(page);
      const $nameInput = await queries.queryByRole($document, 'textbox');

      if ($nameInput) {
        await $nameInput.fill('AudienceUser');
        const $joinButton = await queries.getByRole($document, 'button');
        await $joinButton.click();
      }

      // 少し待機してUIが更新されるのを確認
      await page.waitForTimeout(1000);

      // Testing Libraryを使用してチェックボックスを探して選択
      $document = await getDocument(page);
      const $checkbox = await queries.getByLabelText(
        $document,
        "I'm an audience."
      );
      await $checkbox.click();

      // チェックボックスが選択されていることを確認
      // 型エラーを修正
      const isChecked = await $checkbox.evaluate(el => {
        // 明示的に型アサーションを追加
        return (el as HTMLInputElement).checked;
      });
      assertEquals(isChecked, true);

      // 少し待機してUIが更新されるのを確認
      await page.waitForTimeout(1000);

      // Audienceテキストが含まれる要素があるかを確認
      const audienceTextExists =
        (await queries.queryByText($document, 'Audience')) !== null;
      assertEquals(
        audienceTextExists,
        true,
        'Audienceテキストが画面上に表示されているか'
      );
    } finally {
      // 必ずページとコンテキストをクローズ
      await page.close();
      await _context.close();
    }
  });

  // クリア機能のテスト
  await t.step('投票をクリアできること', async () => {
    const { page, context: _context } = await createPage(browser, roomUrl);

    try {
      // 名前入力がまだ必要な場合は入力
      let $document = await getDocument(page);
      const $nameInput = await queries.queryByRole($document, 'textbox');

      if ($nameInput) {
        await $nameInput.fill('ClearUser');
        const $joinButton = await queries.getByRole($document, 'button');
        await $joinButton.click();
      }

      // 投票オプションが表示されるまで待機
      $document = await getDocument(page);
      const $voteButton = await queries.getByText($document, '5');

      // 投票する（「5」を選択）
      await $voteButton.click();

      // クリアボタンをクリック
      const $clearButton = await queries.getByRole($document, 'button', {
        name: 'clear',
      });
      await $clearButton.click();

      // クリア後は投票が消えていることを確認（選択状態のクラスが消えている）
      await page.waitForTimeout(1000); // クリア処理の完了を待つ

      // ボタンの状態を再確認
      // evalauteの型エラーを修正
      const isNotSelected = await $voteButton.evaluate(el => {
        // HTMLElementとして扱う
        return !(el as HTMLElement).classList.contains('-translate-y-3');
      });
      assertEquals(isNotSelected, true);
    } finally {
      // 必ずページとコンテキストをクローズ
      await page.close();
      await _context.close();
    }
  });

  // テスト完了後にブラウザを閉じる
  await browser.close();

  // テスト完了後にKVストアをクリーンアップ
  await cleanupKVStore();
});
