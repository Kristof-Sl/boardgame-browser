import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePlayerCountPollsFromXmlText } from '../src/bggApi.js'

test('parsePlayerCountPollsFromXmlText extracts ranges from BGG suggested_numplayers polls', () => {
  const xml = `<items>
    <item type="boardgame" id="123">
      <poll name="suggested_numplayers">
        <results numplayers="1">
          <result value="Best" numvotes="2" />
          <result value="Recommended" numvotes="3" />
          <result value="Not Recommended" numvotes="10" />
        </results>
        <results numplayers="2">
          <result value="Best" numvotes="6" />
          <result value="Recommended" numvotes="8" />
        </results>
        <results numplayers="3">
          <result value="Recommended" numvotes="5" />
        </results>
        <results numplayers="4">
          <result value="Not Recommended" numvotes="8" />
        </results>
      </poll>
    </item>
  </items>`

  const ranges = parsePlayerCountPollsFromXmlText(xml)
  assert.deepEqual(ranges['123'], {
    good: { min: 1, max: 3 },
    recommended: { min: 1, max: 3 },
    best: { min: 1, max: 2 },
  })
})
