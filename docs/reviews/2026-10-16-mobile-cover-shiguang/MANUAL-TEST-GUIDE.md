# Issue 3: Shiguang Performance Testing Guide

## Manual Test Procedure

### Step 1: Login
1. Chrome should have opened at `http://127.0.0.1:19085`
2. Enter login credentials as instructed:
   - First field: 拾柒
   - Second field: 拾叁
   - Press Enter
3. Wait for homepage to load

### Step 2: Open Shiguang Chat
1. Click the Shiguang button (拾光) to open the assistant dialog
2. The chat interface should appear

### Step 3: Test Different Query Types
Enter the following queries one by one and **observe the server terminal** for performance logs:

#### Test Query 1: Default Guide
```
你好
```
**Expected**: Fast response with general greeting/guide (no retrieval needed)

#### Test Query 2: Memory Search  
```
找一段厦门旅行的照片
```
**Expected**: Slower response (requires photo retrieval from database)

#### Test Query 3: Whisper Draft
```
帮我写一句想念的话
```
**Expected**: Medium response time (LLM generation, minimal retrieval)

#### Test Query 4: Date Planning
```
想想周末怎么过
```
**Expected**: Medium-to-slow (may trigger retrieval + LLM generation)

### Step 4: Collect Performance Data
Watch the **server terminal** output. For each query, you should see a log line like:

```
[Shiguang Performance] total=XXXms setup=XXms retrieval=XXms local=XXms
```

**Record each measurement** (copy from terminal):
- `total`: End-to-end response time
- `setup`: Request validation and context preparation
- `retrieval`: Time spent in photo/memory retrieval
- `local`: LLM model response time

## Performance Measurement Points

The instrumented code in `server/src/modules/ai/ai.service.js` measures:

1. **Setup phase (lines 612-626)**:
   - Device validation
   - User query parsing
   - Context preparation
   
2. **Retrieval phase (lines 629-639)**:
   - `searchPhotosForAgent()` database query
   - Result formatting into context
   
3. **Local phase (lines 641-653)**:
   - LLM API call to Anthropic Claude
   - Response streaming/collection
   
4. **Total time**:
   - Complete end-to-end measurement

## Expected Bottleneck Identification

Based on the four timing measurements, we can identify:

- If `retrieval` > 500ms: **Database/photo retrieval is the bottleneck**
  - Possible fixes: Add database indexes, optimize query, cache results
  
- If `local` > 2000ms: **LLM response is the bottleneck**
  - Possible fixes: Use streaming UI updates, show "thinking" state earlier
  
- If `setup` > 100ms: **Request validation is slow**
  - Possible fixes: Optimize device session lookup, reduce context building
  
- If `total` - (`setup` + `retrieval` + `local`) > 200ms: **Network/overhead issue**
  - Possible fixes: Check for unnecessary awaits, reduce API round-trips

## Current Status

✅ Performance instrumentation added to `chatWithCoupleAgent()`
✅ Four timing phases implemented
✅ Server running on port 19085 (PID: 45028)
🔄 **Awaiting manual browser test** to collect baseline measurements

## Next Steps After Data Collection

1. Analyze which phase dominates the response time
2. Design targeted optimization based on bottleneck
3. Implement fix
4. Re-run tests to measure improvement
5. Document before/after comparison in final review doc
